import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { StartMessage } from "../domain/StartMessage.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { StartMessageSender } from "../ports/StartMessageSender.js";
import type { StartNotificationApplier } from "../ports/StartNotificationApplier.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import { StateCorrelationError } from "./StateCorrelationError.js";
import { StateConflictError } from "./StateConflictError.js";
import type { StartMessageFactory } from "./StartMessageFactory.js";
import type { StartPackageFactory } from "./StartPackageFactory.js";

/**
 * Delivers one private Teams start message only after canonical state proves
 * contributor branch preparation. Successful delivery records one stable action
 * key so GitHub Actions reruns cannot duplicate a completed Flow bot message.
 */
export class StartNotificationService implements StartNotificationApplier
{
	private readonly stateStore: SubmissionStore;
	private readonly packageFactory: StartPackageFactory;
	private readonly messageFactory: StartMessageFactory;
	private readonly messageSender: StartMessageSender;

	/**
	 * Creates state-aware Teams notification orchestration from deterministic
	 * package generation, message mapping, and external delivery boundaries.
	 *
	 * @param stateStore The canonical optimistic-concurrency submission store.
	 * @param packageFactory The deterministic start-package value factory.
	 * @param messageFactory The normalized Teams message-content factory.
	 * @param messageSender The Power Automate cloud-flow delivery boundary.
	 */
	public constructor(
		stateStore: SubmissionStore,
		packageFactory: StartPackageFactory,
		messageFactory: StartMessageFactory,
		messageSender: StartMessageSender)
	{
		this.stateStore = stateStore;
		this.packageFactory = packageFactory;
		this.messageFactory = messageFactory;
		this.messageSender = messageSender;
	}

	/**
	 * Validates branch correlation, skips an exact completed rerun, sends the
	 * normalized request, and persists completion only after delivery succeeds.
	 * A failed request leaves state unchanged so a later GitHub Actions run can
	 * retry the Teams-only notification.
	 *
	 * @param submission The validated internal contributor submission.
	 * @param azureDevOpsConfig The validated tracking destination configuration.
	 * @param startConfig The validated guidance links used in the Teams message.
	 */
	public async Apply(
		submission: Submission,
		azureDevOpsConfig: AzureDevOpsConfig,
		startConfig: StartConfig): Promise<void>
	{
		const state: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);

		if (state === undefined)
		{
			throw new StateCorrelationError(submission.submissionId);
		}

		this.ValidateState(state, submission);
		const actionKey: string = "teams:start-work";
		const actionComplete: boolean = state.completedActions.includes(actionKey);

		if (!actionComplete)
		{
			const azureDevOpsId: number = this.GetAdoId(state);
			const startPackage: StartPackage = this.packageFactory.Create(submission, azureDevOpsConfig, azureDevOpsId);
			const startMessage: StartMessage = this.messageFactory.Create(submission, startPackage, startConfig);
			await this.messageSender.Send(startMessage);
			await this.SaveCompletion(state, submission, actionKey);
		}
	}

	/**
	 * Records successful external delivery and reconciles one optimistic state
	 * conflict without invoking the sender again. GitHub content reads can briefly
	 * observe the revision immediately before another pipeline step's completed
	 * write. Once Teams has accepted the message, retrying the entire operation
	 * would duplicate that irreversible side effect, so this method reloads the
	 * canonical record, validates its identity, and retries only the state save.
	 *
	 * @param state The state revision used to authorize the delivered message.
	 * @param submission The validated submission used for correlation checks.
	 * @param actionKey The stable completion key for start-message delivery.
	 */
	private async SaveCompletion(state: SubmissionState, submission: Submission, actionKey: string): Promise<void>
	{
		state.completedActions.push(actionKey);

		try
		{
			await this.stateStore.Save(state, state.revision);
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

			this.ValidateState(currentState, submission);

			if (!currentState.completedActions.includes(actionKey))
			{
				currentState.completedActions.push(actionKey);
				await this.stateStore.Save(currentState, currentState.revision);
			}
		}
	}

	/**
	 * Requires repository, article, immutable contributor, branch intent, initial
	 * SHA, and completed branch creation before a start message can claim work is
	 * ready. Missing or mismatched proof stops before external delivery.
	 *
	 * @param state The canonical submission state loaded for notification.
	 * @param submission The validated submission requesting notification.
	 */
	private ValidateState(state: SubmissionState, submission: Submission): void
	{
		const expectedBranch: string = "contrib/" + submission.submissionId;
		const ownerMatches: boolean = state.repository.owner === submission.repository.owner;
		const repositoryMatches: boolean = state.repository.name === submission.repository.name;
		const articleMatches: boolean = state.articlePath === submission.articlePath;
		const branchMatches: boolean = state.branchName === expectedBranch;
		const identityComplete: boolean = state.githubUserId !== undefined;
		const commitComplete: boolean = state.initialCommitSha !== undefined;
		const branchComplete: boolean = state.completedActions.includes("github:create-contributor-branch");
		const stateValid: boolean = ownerMatches && repositoryMatches && articleMatches && branchMatches && identityComplete && commitComplete && branchComplete;

		if (!stateValid)
		{
			throw new StateCorrelationError(submission.submissionId);
		}
	}

	/**
	 * Requires the correlated Azure DevOps identifier used by the tracking link.
	 *
	 * @param state The canonical state expected to contain Stage 5 correlation.
	 * @returns The positive Azure DevOps User Story identifier.
	 */
	private GetAdoId(state: SubmissionState): number
	{
		if (state.azureDevOpsId === undefined)
		{
			throw new StateCorrelationError(state.submissionId);
		}

		return state.azureDevOpsId;
	}
}