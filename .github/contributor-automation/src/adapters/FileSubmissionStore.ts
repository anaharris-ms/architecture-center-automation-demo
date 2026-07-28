import fs from "node:fs/promises";
import path from "node:path";
import { StateConflictError } from "../application/StateConflictError.js";
import type { SubmissionStateCodec } from "../application/SubmissionStateCodec.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";

/**
 * Persists one canonical JSON document per submission in a local directory.
 * Writes use an atomic rename and revision comparison so local and integration
 * tests exercise the durable behavior expected from the GitHub-backed store.
 */
export class FileSubmissionStore implements SubmissionStore
{
	private readonly directoryPath: string;
	private readonly codec: SubmissionStateCodec;

	/**
	 * Creates a file store rooted at the supplied state directory.
	 *
	 * @param directoryPath The directory containing submission JSON documents.
	 * @param codec The shared canonical state serialization boundary.
	 */
	public constructor(directoryPath: string, codec: SubmissionStateCodec)
	{
		this.directoryPath = directoryPath;
		this.codec = codec;
	}

	/**
	 * Loads and validates one state document when it exists.
	 *
	 * @param submissionId The stable submission identity to load.
	 * @returns The decoded state, or undefined when no document exists.
	 */
	public async Load(submissionId: string): Promise<SubmissionState | undefined>
	{
		const filePath: string = this.GetPath(submissionId);
		let state: SubmissionState | undefined = undefined;

		try
		{
			const stateText: string = await fs.readFile(filePath, "utf8");
			state = this.codec.Decode(stateText, filePath);
		}
		catch (error: unknown)
		{
			if (!this.IsMissing(error))
			{
				throw error;
			}
		}

		return state;
	}

	/**
	 * Creates or updates a document after comparing the latest stored revision.
	 * The temporary document is renamed only after its complete content is on
	 * disk, preventing a reader from observing a partial JSON write.
	 *
	 * @param state The complete canonical state to persist.
	 * @param expectedRevision The revision observed by the caller.
	 * @returns The saved detached state with its assigned revision.
	 */
	public async Save(state: SubmissionState, expectedRevision: number | undefined): Promise<SubmissionState>
	{
		const existingState: SubmissionState | undefined = await this.Load(state.submissionId);
		let storedRevision: number | undefined = undefined;

		if (existingState !== undefined)
		{
			storedRevision = existingState.revision;
		}

		if (storedRevision !== expectedRevision)
		{
			throw new StateConflictError(state.submissionId);
		}

		const savedState: SubmissionState = this.codec.Clone(state);
		savedState.revision = expectedRevision === undefined ? 1 : expectedRevision + 1;
		const filePath: string = this.GetPath(savedState.submissionId);
		const temporaryPath: string = filePath + "." + process.pid.toString() + ".tmp";
		const stateText: string = this.codec.Encode(savedState);
		await fs.mkdir(this.directoryPath, { recursive: true });
		await fs.writeFile(temporaryPath, stateText, "utf8");
		await fs.rename(temporaryPath, filePath);

		return this.codec.Clone(savedState);
	}

	/**
	 * Loads all state documents and returns records matching every defined query
	 * field in stable submission-ID order.
	 *
	 * @param query The repository-owned correlation criteria.
	 * @returns All matching validated state records.
	 */
	public async Find(query: SubmissionQuery): Promise<SubmissionState[]>
	{
		const matches: SubmissionState[] = [];
		let fileNames: string[] = [];

		try
		{
			fileNames = await fs.readdir(this.directoryPath);
		}
		catch (error: unknown)
		{
			if (!this.IsMissing(error))
			{
				throw error;
			}
		}

		fileNames.sort();

		for (const fileName of fileNames)
		{
			if (fileName.endsWith(".json"))
			{
				const submissionId: string = fileName.substring(0, fileName.length - 5);
				const state: SubmissionState | undefined = await this.Load(submissionId);

				if (state !== undefined && this.Matches(state, query))
				{
					matches.push(state);
				}
			}
		}

		return matches;
	}

	/**
	 * Creates the canonical local path for a validated submission identity.
	 *
	 * @param submissionId The stable submission identity used as the filename.
	 * @returns The complete local JSON document path.
	 */
	private GetPath(submissionId: string): string
	{
		const safePattern: RegExp = /^HACK-[0-9]{4,}$/;

		if (!safePattern.test(submissionId))
		{
			throw new Error("Submission ID cannot be used as a state filename.");
		}

		return path.join(this.directoryPath, submissionId + ".json");
	}

	/**
	 * Determines whether a file-system error means the requested path is absent.
	 *
	 * @param error The unknown error raised by a file-system operation.
	 * @returns True only for a Node file-not-found error.
	 */
	private IsMissing(error: unknown): boolean
	{
		let isMissing: boolean = false;

		if (typeof error === "object" && error !== null && "code" in error)
		{
			isMissing = error.code === "ENOENT";
		}

		return isMissing;
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