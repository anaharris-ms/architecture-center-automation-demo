import type { PullRequestObservation } from "../domain/PullRequestObservation.js";
import { PullRequestOutcome } from "../domain/PullRequestOutcome.js";
import type { PullRequestResult } from "../domain/PullRequestResult.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import type { PullRequestApplier } from "../ports/PullRequestApplier.js";
import { StateCorrelationError } from "./StateCorrelationError.js";

/**
 * Correlates one normalized GitHub pull request to canonical submission state.
 * Exact HACK identity evidence is authoritative within the expected repository;
 * without it, immutable author, repository, and changed article must all match.
 */
export class PullRequestService implements PullRequestApplier
{
	private readonly stateStore: SubmissionStore;

	/**
	 * Creates pull-request detection over the canonical query and save boundary.
	 *
	 * @param stateStore The optimistic-concurrency submission state store.
	 */
	public constructor(stateStore: SubmissionStore)
	{
		this.stateStore = stateStore;
	}

	/**
	 * Resolves one observation, reports ambiguity rather than guessing, and saves
	 * the pull-request number and open stage only after exactly one state matches.
	 * An exact rerun performs no additional state save or stage regression.
	 *
	 * @param observation The validated and enriched GitHub pull-request facts.
	 * @returns The explicit matched, unmatched, or ambiguous result.
	 */
	public async Apply(observation: PullRequestObservation): Promise<PullRequestResult>
	{
		this.Validate(observation);
		const submissionIds: string[] = this.ExtractIds(observation);
		let matches: SubmissionState[] = [];
		let outcome: PullRequestOutcome = PullRequestOutcome.Unmatched;

		if (submissionIds.length > 1)
		{
			outcome = PullRequestOutcome.Ambiguous;
		}
		else if (submissionIds.length === 1)
		{
			const exactId: string | undefined = submissionIds[0];

			if (exactId === undefined)
			{
				throw new Error("Pull-request identity extraction produced an invalid result.");
			}

			matches = await this.FindById(exactId, observation);
		}
		else
		{
			matches = await this.FindFallback(observation);
		}

		if (outcome !== PullRequestOutcome.Ambiguous)
		{
			if (matches.length === 1)
			{
				outcome = PullRequestOutcome.Matched;
			}
			else if (matches.length > 1)
			{
				outcome = PullRequestOutcome.Ambiguous;
			}
		}

		let submissionId: string | undefined = undefined;

		if (outcome === PullRequestOutcome.Matched)
		{
			const state: SubmissionState | undefined = matches[0];

			if (state === undefined)
			{
				throw new Error("Matched pull-request correlation did not contain state.");
			}

			await this.SaveMatch(state, observation.pullRequestNumber, observation.headCommitSha);
			submissionId = state.submissionId;
		}

		const result: PullRequestResult =
			{
				outcome: outcome,
				submissionId: submissionId
			};

		return result;
	}

	/**
	 * Extracts unique exact HACK identities from the branch, title, and body.
	 * Repeated evidence for the same submission remains one candidate, while two
	 * different identities force an ambiguous result before any state query.
	 *
	 * @param observation The normalized pull-request text and branch facts.
	 * @returns Stable unique identities in first-observed order.
	 */
	private ExtractIds(observation: PullRequestObservation): string[]
	{
		const values: string[] = [observation.headBranch, observation.title, observation.body];
		const submissionIds: string[] = [];
		const idPattern: RegExp = /\bHACK-[0-9]{4,}\b/g;

		for (const value of values)
		{
			const matches: RegExpStringIterator<RegExpExecArray> = value.matchAll(idPattern);

			for (const match of matches)
			{
				const submissionId: string = match[0];

				if (!submissionIds.includes(submissionId))
				{
					submissionIds.push(submissionId);
				}
			}
		}

		return submissionIds;
	}

	/**
	 * Loads exact identity evidence and retains it only when the event repository
	 * equals the repository recorded for that submission.
	 *
	 * @param submissionId The sole exact HACK identity found in event evidence.
	 * @param observation The normalized event repository facts.
	 * @returns Zero or one repository-correlated canonical state records.
	 */
	private async FindById(
		submissionId: string,
		observation: PullRequestObservation): Promise<SubmissionState[]>
	{
		const state: SubmissionState | undefined = await this.stateStore.Load(submissionId);
		const matches: SubmissionState[] = [];

		if (state !== undefined)
		{
			const ownerMatches: boolean = state.repository.owner === observation.repository.owner;
			const repositoryMatches: boolean = state.repository.name === observation.repository.name;

			if (ownerMatches && repositoryMatches)
			{
				matches.push(state);
			}
		}

		return matches;
	}

	/**
	 * Queries each unique changed path using every strict fallback key and merges
	 * results by submission identity so one state cannot create false ambiguity.
	 *
	 * @param observation The normalized author, repository, and changed paths.
	 * @returns All distinct states satisfying every fallback correlation field.
	 */
	private async FindFallback(observation: PullRequestObservation): Promise<SubmissionState[]>
	{
		const matches: SubmissionState[] = [];
		const searchedPaths: string[] = [];

		for (const articlePath of observation.changedPaths)
		{
			if (!searchedPaths.includes(articlePath))
			{
				searchedPaths.push(articlePath);
				const query: SubmissionQuery = this.CreateQuery(observation, articlePath);
				const pathMatches: SubmissionState[] = await this.stateStore.Find(query);

				for (const state of pathMatches)
				{
					const alreadyMatched: boolean = this.HasMatch(matches, state.submissionId);

					if (!alreadyMatched)
					{
						matches.push(state);
					}
				}
			}
		}

		return matches;
	}

	/**
	 * Checks whether accumulated fallback results already contain one submission
	 * so duplicate changed paths cannot produce false ambiguity.
	 *
	 * @param matches The distinct state records accumulated so far.
	 * @param submissionId The stable identity being checked.
	 * @returns True when the submission is already represented.
	 */
	private HasMatch(matches: SubmissionState[], submissionId: string): boolean
	{
		let matchFound: boolean = false;

		for (const state of matches)
		{
			if (state.submissionId === submissionId)
			{
				matchFound = true;
			}
		}

		return matchFound;
	}

	/**
	 * Builds one strict fallback query without embedding GitHub event structure
	 * in the persistence contract.
	 *
	 * @param observation The normalized immutable author and repository facts.
	 * @param articlePath One changed repository-relative path to correlate.
	 * @returns A query requiring identity, repository, and article equality.
	 */
	private CreateQuery(observation: PullRequestObservation, articlePath: string): SubmissionQuery
	{
		const query: SubmissionQuery =
			{
				submissionId: undefined,
				githubUserId: observation.authorUserId,
				repositoryOwner: observation.repository.owner,
				repositoryName: observation.repository.name,
				branchName: undefined,
				articlePath: articlePath,
				pullRequestNumber: undefined,
				azureDevOpsId: undefined
			};

		return query;
	}

	/**
	 * Persists first detection atomically and rejects a different pull-request
	 * number from replacing durable correlation for the same submission.
	 *
	 * @param state The sole canonical state matched by event evidence.
	 * @param pullRequestNumber The positive GitHub pull-request number.
	 * @param headCommitSha The authoritative full pull-request head SHA.
	 */
	private async SaveMatch(state: SubmissionState, pullRequestNumber: number, headCommitSha: string): Promise<void>
	{
		if (state.pullRequestNumber !== undefined && state.pullRequestNumber !== pullRequestNumber)
		{
			throw new StateCorrelationError(state.submissionId);
		}

		if (state.pullRequestNumber === undefined)
		{
			state.pullRequestNumber = pullRequestNumber;
			state.currentStage = SubmissionStage.TechnicalReview;
			state.reviewState.openedCommitSha = headCommitSha;
			await this.stateStore.Save(state, state.revision);
		}
	}

	/**
	 * Defends the application boundary against malformed adapter output before
	 * values can be used for state queries or canonical persistence.
	 *
	 * @param observation The normalized observation to validate.
	 */
	private Validate(observation: PullRequestObservation): void
	{
		const numberValid: boolean = Number.isSafeInteger(observation.pullRequestNumber) && observation.pullRequestNumber > 0;
		const authorValid: boolean = Number.isSafeInteger(observation.authorUserId) && observation.authorUserId > 0;
		const ownerValid: boolean = observation.repository.owner.trim().length > 0;
		const repositoryValid: boolean = observation.repository.name.trim().length > 0;
		const branchValid: boolean = observation.headBranch.trim().length > 0;
		const shaValid: boolean = /^[0-9a-fA-F]{40}$/.test(observation.headCommitSha);

		if (!numberValid || !authorValid || !ownerValid || !repositoryValid || !branchValid || !shaValid)
		{
			throw new Error("Pull-request observation contains invalid correlation values.");
		}

		for (const changedPath of observation.changedPaths)
		{
			if (changedPath.trim().length === 0)
			{
				throw new Error("Pull-request observation contains an invalid changed path.");
			}
		}
	}
}