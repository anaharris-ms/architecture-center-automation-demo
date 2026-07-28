import type { BranchBase } from "../domain/BranchBase.js";
import type { ContributorBranch } from "../domain/ContributorBranch.js";
import { EligibilityOutcome } from "../domain/EligibilityOutcome.js";
import type { EligibilityResult } from "../domain/EligibilityResult.js";
import type { Submission } from "../domain/Submission.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { ContributorBranchClient } from "../ports/ContributorBranchClient.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import type { ContributorAccessService } from "./ContributorAccessService.js";
import { ContributorEligibilityError } from "./ContributorEligibilityError.js";
import { StateCorrelationError } from "./StateCorrelationError.js";
import { StateConflictError } from "./StateConflictError.js";

/**
 * Rechecks current contributor access and prepares one deterministic GitHub
 * branch with durable pre-mutation correlation. Persisting branch intent first
 * lets retries recognize a branch created immediately before a later state
 * write failed, while unrelated existing branches are never adopted.
 */
export class ContributorBranchService
{
	private readonly stateStore: SubmissionStore;
	private readonly accessService: ContributorAccessService;
	private readonly branchClient: ContributorBranchClient;

	/**
	 * Creates branch orchestration from canonical state, current access checking,
	 * and an authenticated GitHub branch boundary.
	 *
	 * @param stateStore The canonical optimistic-concurrency state store.
	 * @param accessService The service that rechecks and persists contributor identity.
	 * @param branchClient The GitHub branch fact and mutation boundary.
	 */
	public constructor(
		stateStore: SubmissionStore,
		accessService: ContributorAccessService,
		branchClient: ContributorBranchClient)
	{
		this.stateStore = stateStore;
		this.accessService = accessService;
		this.branchClient = branchClient;
	}

	/**
	 * Verifies eligibility immediately before branch work, rejects uncorrelated
	 * existing branches, persists the selected base SHA before mutation, and
	 * records completion only after GitHub confirms creation or safe reuse.
	 *
	 * @param submission The validated contribution whose branch is being prepared.
	 * @returns The correlated branch and whether this invocation created it.
	 */
	public async Prepare(submission: Submission): Promise<ContributorBranch>
	{
		const eligibility: EligibilityResult = await this.accessService.Verify(submission);

		if (eligibility.outcome !== EligibilityOutcome.Eligible)
		{
			throw new ContributorEligibilityError(submission.submissionId, eligibility.outcome);
		}

		let state: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);

		if (state === undefined)
		{
			throw new StateCorrelationError(submission.submissionId);
		}

		const branchName: string = "contrib/" + submission.submissionId;
		this.ValidateState(state, submission, branchName);
		const existingSha: string | undefined = await this.branchClient.Find(submission.repository, branchName);
		let created: boolean = false;

		if (existingSha !== undefined)
		{
			this.RequireProof(state, branchName);
		}
		else
		{
			state = await this.SaveIntent(state, submission, branchName);
			const initialCommitSha: string = this.GetInitialSha(state);
			await this.branchClient.Create(submission.repository, branchName, initialCommitSha);
			created = true;
		}

		state = await this.SaveComplete(state, submission, branchName);
		const result: ContributorBranch =
			{
				branchName: branchName,
				initialCommitSha: this.GetInitialSha(state),
				created: created
			};

		return result;
	}

	/**
	 * Protects submission identity fields and any prior branch name before branch
	 * facts are read or external mutations are attempted.
	 *
	 * @param state The canonical state loaded after current access verification.
	 * @param submission The validated submission requesting branch preparation.
	 * @param branchName The deterministic branch required for this submission.
	 */
	private ValidateState(state: SubmissionState, submission: Submission, branchName: string): void
	{
		const ownerMatches: boolean = state.repository.owner === submission.repository.owner;
		const repositoryMatches: boolean = state.repository.name === submission.repository.name;
		const articleMatches: boolean = state.articlePath === submission.articlePath;
		const branchMatches: boolean = state.branchName === undefined || state.branchName === branchName;

		if (!ownerMatches || !repositoryMatches || !articleMatches || !branchMatches)
		{
			throw new StateCorrelationError(submission.submissionId);
		}
	}

	/**
	 * Requires canonical branch name and initial SHA before an existing external
	 * branch can be reused. A name alone from an older start-package record does
	 * not prove that automation created the GitHub reference.
	 *
	 * @param state The current canonical submission state.
	 * @param branchName The deterministic branch found in GitHub.
	 */
	private RequireProof(state: SubmissionState, branchName: string): void
	{
		const branchProven: boolean = state.branchName === branchName;
		const commitProven: boolean = state.initialCommitSha !== undefined;

		if (!branchProven || !commitProven)
		{
			throw new StateCorrelationError(state.submissionId);
		}
	}

	/**
	 * Persists deterministic branch intent and the selected base-branch SHA
	 * before GitHub mutation. Existing intent is reused so a retry never advances
	 * silently to a newer configured base-branch commit.
	 *
	 * @param state The canonical state that will own the branch correlation.
	 * @param submission The validated submission supplying the repository target.
	 * @param branchName The deterministic contributor branch name.
	 * @returns State carrying a persisted branch name and initial commit SHA.
	 */
	private async SaveIntent(state: SubmissionState, submission: Submission, branchName: string): Promise<SubmissionState>
	{
		let stateChanged: boolean = false;

		if (state.branchName === undefined)
		{
			state.branchName = branchName;
			stateChanged = true;
		}

		if (state.initialCommitSha === undefined)
		{
			const branchBase: BranchBase = await this.branchClient.GetBase(submission.repository);
			state.initialCommitSha = branchBase.commitSha;
			stateChanged = true;
		}

		if (stateChanged)
		{
			state = await this.stateStore.Save(state, state.revision);
		}

		return state;
	}

	/**
	 * Records branch completion exactly once after GitHub confirms the reference.
	 * If the first save conflicts, canonical state is reloaded and its persisted
	 * branch proof is revalidated before only the completion save is retried.
	 * The external branch mutation is never repeated by this reconciliation.
	 *
	 * @param state The state containing durable branch intent and base SHA.
	 * @param submission The validated submission used for correlation checks.
	 * @param branchName The deterministic contributor branch proven by state.
	 * @returns The saved state, or the unchanged state on an exact rerun.
	 */
	private async SaveComplete(
		state: SubmissionState,
		submission: Submission,
		branchName: string): Promise<SubmissionState>
	{
		const actionKey: string = "github:create-contributor-branch";

		if (!state.completedActions.includes(actionKey))
		{
			state.completedActions.push(actionKey);

			try
			{
				state = await this.stateStore.Save(state, state.revision);
			}
			catch (error: unknown)
			{
				if (!(error instanceof StateConflictError))
				{
					throw error;
				}

				const currentState: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);

				if (currentState === undefined)
				{
					throw new StateCorrelationError(submission.submissionId);
				}

				this.ValidateState(currentState, submission, branchName);
				this.RequireProof(currentState, branchName);

				if (!currentState.completedActions.includes(actionKey))
				{
					currentState.completedActions.push(actionKey);
					state = await this.stateStore.Save(currentState, currentState.revision);
				}
				else
				{
					state = currentState;
				}
			}
		}

		return state;
	}

	/**
	 * Requires the persisted initial SHA before branch creation or result mapping.
	 *
	 * @param state The canonical state expected to contain branch intent.
	 * @returns The full initial commit SHA selected for the contributor branch.
	 */
	private GetInitialSha(state: SubmissionState): string
	{
		if (state.initialCommitSha === undefined)
		{
			throw new StateCorrelationError(state.submissionId);
		}

		return state.initialCommitSha;
	}
}