import { ContentConflictError } from "../application/ContentConflictError.js";
import { StateConflictError } from "../application/StateConflictError.js";
import type { SubmissionStateCodec } from "../application/SubmissionStateCodec.js";
import type { StateContent } from "../contracts/StateContent.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { StateContentClient } from "../ports/StateContentClient.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";

/**
 * Persists canonical submission JSON through a revision-aware GitHub content
 * client. Each save checks the numeric state revision and supplies the latest
 * GitHub SHA so stale workflows cannot overwrite a newer state commit.
 */
export class GitHubSubmissionStore implements SubmissionStore
{
	private readonly client: StateContentClient;
	private readonly codec: SubmissionStateCodec;
	private readonly directoryPath: string;

	/**
	 * Creates a durable store for one directory on the dedicated state branch.
	 *
	 * @param client The revision-aware GitHub content boundary.
	 * @param codec The canonical state serialization boundary.
	 * @param directoryPath The branch directory containing state documents.
	 */
	public constructor(client: StateContentClient, codec: SubmissionStateCodec, directoryPath: string)
	{
		this.client = client;
		this.codec = codec;
		this.directoryPath = directoryPath;
	}

	/**
	 * Loads and validates one canonical state document from GitHub.
	 *
	 * @param submissionId The stable submission identity to load.
	 * @returns The decoded state, or undefined when no document exists.
	 */
	public async Load(submissionId: string): Promise<SubmissionState | undefined>
	{
		const contentPath: string = this.GetPath(submissionId);
		const stateContent: StateContent | undefined = await this.client.Read(contentPath);
		let state: SubmissionState | undefined = undefined;

		if (stateContent !== undefined)
		{
			state = this.codec.Decode(stateContent.content, contentPath);
		}

		return state;
	}

	/**
	 * Saves state after reading the latest numeric revision and GitHub content
	 * SHA. A service-level SHA conflict is normalized to StateConflictError.
	 *
	 * @param state The complete canonical state to persist.
	 * @param expectedRevision The numeric revision observed by the caller.
	 * @returns The detached saved state with its newly assigned revision.
	 */
	public async Save(state: SubmissionState, expectedRevision: number | undefined): Promise<SubmissionState>
	{
		const contentPath: string = this.GetPath(state.submissionId);
		const existingContent: StateContent | undefined = await this.client.Read(contentPath);
		let storedRevision: number | undefined = undefined;
		let contentRevision: string | undefined = undefined;

		if (existingContent !== undefined)
		{
			const existingState: SubmissionState = this.codec.Decode(existingContent.content, contentPath);
			storedRevision = existingState.revision;
			contentRevision = existingContent.revision;
		}

		if (storedRevision !== expectedRevision)
		{
			throw new StateConflictError(state.submissionId);
		}

		const savedState: SubmissionState = this.codec.Clone(state);
		savedState.revision = expectedRevision === undefined ? 1 : expectedRevision + 1;
		const stateText: string = this.codec.Encode(savedState);
		const commitMessage: string = "Update submission state for " + savedState.submissionId;

		try
		{
			await this.client.Write(contentPath, stateText, contentRevision, commitMessage);
		}
		catch (error: unknown)
		{
			if (error instanceof ContentConflictError)
			{
				throw new StateConflictError(state.submissionId);
			}

			throw error;
		}

		return this.codec.Clone(savedState);
	}

	/**
	 * Loads listed JSON documents and applies repository-owned correlation rules
	 * without exposing GitHub directory payloads to application behavior.
	 *
	 * @param query The repository-owned correlation criteria.
	 * @returns Matching canonical records in stable submission-ID order.
	 */
	public async Find(query: SubmissionQuery): Promise<SubmissionState[]>
	{
		const contentPaths: string[] = await this.client.List(this.directoryPath);
		const matches: SubmissionState[] = [];

		contentPaths.sort();

		for (const contentPath of contentPaths)
		{
			if (contentPath.endsWith(".json"))
			{
				const stateContent: StateContent | undefined = await this.client.Read(contentPath);

				if (stateContent !== undefined)
				{
					const state: SubmissionState = this.codec.Decode(stateContent.content, contentPath);

					if (this.Matches(state, query))
					{
						matches.push(state);
					}
				}
			}
		}

		return matches;
	}

	/**
	 * Builds the dedicated branch path for one safe stable submission identity.
	 *
	 * @param submissionId The stable submission identity used as the filename.
	 * @returns The repository-relative JSON document path.
	 */
	private GetPath(submissionId: string): string
	{
		const safePattern: RegExp = /^HACK-[0-9]{4,}$/;

		if (!safePattern.test(submissionId))
		{
			throw new Error("Submission ID cannot be used as a state path.");
		}

		return this.directoryPath + "/" + submissionId + ".json";
	}

	/**
	 * Determines whether one state record matches every supplied query field.
	 *
	 * @param state The canonical state being considered.
	 * @param query The correlation criteria supplied by the caller.
	 * @returns True when all defined criteria match the record.
	 */
	private Matches(state: SubmissionState, query: SubmissionQuery): boolean
	{
		const submissionMatches: boolean = query.submissionId === undefined || state.submissionId === query.submissionId;
		const githubUserMatches: boolean = query.githubUserId === undefined || state.githubUserId === query.githubUserId;
		const ownerMatches: boolean = query.repositoryOwner === undefined || state.repository.owner === query.repositoryOwner;
		const repositoryMatches: boolean = query.repositoryName === undefined || state.repository.name === query.repositoryName;
		const branchMatches: boolean = query.branchName === undefined || state.branchName === query.branchName;
		const articleMatches: boolean = query.articlePath === undefined || state.articlePath === query.articlePath;
		const pullRequestMatches: boolean = query.pullRequestNumber === undefined || state.pullRequestNumber === query.pullRequestNumber;
		const azureDevOpsMatches: boolean = query.azureDevOpsId === undefined || state.azureDevOpsId === query.azureDevOpsId;
		const matches: boolean = submissionMatches && githubUserMatches && ownerMatches && repositoryMatches && branchMatches && articleMatches && pullRequestMatches && azureDevOpsMatches;

		return matches;
	}
}