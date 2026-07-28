import { EligibilityOutcome } from "../domain/EligibilityOutcome.js";
import type { EligibilityResult } from "../domain/EligibilityResult.js";
import type { Submission } from "../domain/Submission.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { ContributorVerifier } from "../ports/ContributorVerifier.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import { StateCorrelationError } from "./StateCorrelationError.js";
import type { SubmissionStateFactory } from "./SubmissionStateFactory.js";

/**
 * Verifies current GitHub contributor eligibility and persists immutable user
 * identity only after every required check succeeds. Each call invokes the
 * verifier so callers can recheck current access immediately before mutation.
 */
export class ContributorAccessService
{
	private readonly stateStore: SubmissionStore;
	private readonly stateFactory: SubmissionStateFactory;
	private readonly contributorVerifier: ContributorVerifier;

	/**
	 * Creates state-aware contributor verification from persistence, state
	 * construction, and external GitHub verification boundaries.
	 *
	 * @param stateStore The canonical optimistic-concurrency state store.
	 * @param stateFactory The factory for a submission without existing state.
	 * @param contributorVerifier The normalized current GitHub fact boundary.
	 */
	public constructor(
		stateStore: SubmissionStore,
		stateFactory: SubmissionStateFactory,
		contributorVerifier: ContributorVerifier)
	{
		this.stateStore = stateStore;
		this.stateFactory = stateFactory;
		this.contributorVerifier = contributorVerifier;
	}

	/**
	 * Checks current eligibility and records the immutable GitHub user ID once.
	 * Blocked outcomes do not create or change canonical state. A changed numeric
	 * identity for an existing submission fails as a correlation conflict.
	 *
	 * @param submission The normalized intake submission being verified.
	 * @returns The normalized eligibility result supplied by the verifier.
	 */
	public async Verify(submission: Submission): Promise<EligibilityResult>
	{
		const result: EligibilityResult = await this.contributorVerifier.Verify(
			submission.contributor.githubUsername,
			submission.repository);

		if (result.outcome === EligibilityOutcome.Eligible)
		{
			const githubUserId: number = this.GetUserId(result);
			await this.SaveIdentity(submission, githubUserId);
		}
		else if (result.githubUserId !== undefined)
		{
			throw new Error("Blocked GitHub eligibility results must not include a user ID.");
		}

		return result;
	}

	/**
	 * Requires a positive safe integer for a successful eligibility outcome.
	 * This protects canonical state from malformed or lossy adapter responses.
	 *
	 * @param result The successful normalized verifier response.
	 * @returns The validated positive immutable GitHub user identity.
	 */
	private GetUserId(result: EligibilityResult): number
	{
		if (result.githubUserId === undefined || !Number.isSafeInteger(result.githubUserId) || result.githubUserId < 1)
		{
			throw new Error("Eligible GitHub results must include a positive safe integer user ID.");
		}

		return result.githubUserId;
	}

	/**
	 * Creates or validates canonical submission state and saves a newly resolved
	 * identity with optimistic concurrency. An exact rerun performs no state save.
	 *
	 * @param submission The normalized submission owning the identity.
	 * @param githubUserId The verified immutable numeric GitHub user identity.
	 */
	private async SaveIdentity(submission: Submission, githubUserId: number): Promise<void>
	{
		let state: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);
		let expectedRevision: number | undefined = undefined;

		if (state === undefined)
		{
			state = this.stateFactory.Create(submission);
		}
		else
		{
			expectedRevision = state.revision;
			this.ValidateState(state, submission, githubUserId);
		}

		if (state.githubUserId === undefined)
		{
			state.githubUserId = githubUserId;
			await this.stateStore.Save(state, expectedRevision);
		}
	}

	/**
	 * Protects repository, article, and immutable contributor correlation before
	 * an existing state record can be reused or changed by verification.
	 *
	 * @param state The loaded canonical state record.
	 * @param submission The normalized submission being verified.
	 * @param githubUserId The newly verified immutable GitHub identity.
	 */
	private ValidateState(state: SubmissionState, submission: Submission, githubUserId: number): void
	{
		const ownerMatches: boolean = state.repository.owner === submission.repository.owner;
		const repositoryMatches: boolean = state.repository.name === submission.repository.name;
		const articleMatches: boolean = state.articlePath === submission.articlePath;
		const identityMatches: boolean = state.githubUserId === undefined || state.githubUserId === githubUserId;

		if (!ownerMatches || !repositoryMatches || !articleMatches || !identityMatches)
		{
			throw new StateCorrelationError(submission.submissionId);
		}
	}
}
