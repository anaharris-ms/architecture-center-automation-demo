import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import { ReviewAction } from "../domain/ReviewAction.js";
import type { ReviewTransition } from "../domain/ReviewTransition.js";
import type { StageMessage } from "../domain/StageMessage.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { StageMessageSender } from "../ports/StageMessageSender.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import { StateConflictError } from "./StateConflictError.js";
import { StateCorrelationError } from "./StateCorrelationError.js";

/**
 * Posts one group-chat handoff after a durable stage transition and records a
 * stable completion key so event reruns cannot duplicate successful messages.
 */
export class StageNotificationService
{
	private readonly stateStore: SubmissionStore;
	private readonly messageSender: StageMessageSender;

	/**
	 * Creates stage notifications over canonical state and an external sender.
	 *
	 * @param stateStore The optimistic-concurrency submission state store.
	 * @param messageSender The Power Automate stage-message boundary.
	 */
	public constructor(stateStore: SubmissionStore, messageSender: StageMessageSender)
	{
		this.stateStore = stateStore;
		this.messageSender = messageSender;
	}

	/**
	 * Requires the transition in canonical history, sends its direct PR handoff
	 * once, and persists delivery completion after the external action succeeds.
	 *
	 * @param repository The allowlisted base repository containing the PR.
	 * @param pullRequestNumber The positive correlated pull-request number.
	 * @param transition The accepted durable review transition.
	 */
	public async Apply(
		repository: RepositoryTarget,
		pullRequestNumber: number,
		transition: ReviewTransition): Promise<void>
	{
		const state: SubmissionState = await this.FindState(repository, pullRequestNumber);
		this.RequireTransition(state, transition);
		const actionKey: string = "teams:stage:" + transition.eventId;

		if (!state.completedActions.includes(actionKey))
		{
			const message: StageMessage = this.CreateMessage(state, repository, pullRequestNumber, transition);
			await this.messageSender.Send(message);
			await this.SaveCompletion(state, repository, pullRequestNumber, transition, actionKey);
		}
	}

	/**
	 * Announces the initial technical-review handoff after authoritative PR
	 * correlation. An unmatched PR remains a valid no-op, while a stable action
	 * key prevents an opened-event rerun from posting the handoff twice.
	 *
	 * @param repository The allowlisted base repository containing the PR.
	 * @param pullRequestNumber The positive pull-request number.
	 */
	public async AnnounceOpen(repository: RepositoryTarget, pullRequestNumber: number): Promise<void>
	{
		const state: SubmissionState | undefined = await this.FindOptional(repository, pullRequestNumber);

		if (state !== undefined)
		{
			if (state.currentStage !== SubmissionStage.TechnicalReview)
			{
				throw new StateCorrelationError(state.submissionId);
			}

			const actionKey: string = "teams:stage:pull-request-opened:" + pullRequestNumber.toString();

			if (!state.completedActions.includes(actionKey))
			{
				const pullRequestUrl: string = this.CreateUrl(repository, pullRequestNumber);
				const message: StageMessage =
					{
						submissionId: state.submissionId,
						eventId: actionKey,
						action: ReviewAction.PullRequestOpened,
						fromStage: SubmissionStage.Drafting,
						toStage: SubmissionStage.TechnicalReview,
						pullRequestUrl: pullRequestUrl
					};
				await this.messageSender.Send(message);
				state.completedActions.push(actionKey);
				await this.stateStore.Save(state, state.revision);
			}
		}
	}

	/**
	 * Loads exactly one state by repository and pull-request correlation.
	 *
	 * @param repository The base repository identity.
	 * @param pullRequestNumber The correlated pull-request number.
	 * @returns The sole canonical state.
	 */
	private async FindState(repository: RepositoryTarget, pullRequestNumber: number): Promise<SubmissionState>
	{
		const state: SubmissionState | undefined = await this.FindOptional(repository, pullRequestNumber);

		if (state === undefined)
		{
			throw new StateCorrelationError("pull request " + pullRequestNumber.toString());
		}

		return state;
	}

	/**
	 * Loads zero or one state by repository and pull-request correlation while
	 * rejecting ambiguous canonical data.
	 *
	 * @param repository The base repository identity.
	 * @param pullRequestNumber The correlated pull-request number.
	 * @returns The sole state, or undefined when the PR is not correlated.
	 */
	private async FindOptional(
		repository: RepositoryTarget,
		pullRequestNumber: number): Promise<SubmissionState | undefined>
	{
		const query: SubmissionQuery =
			{
				submissionId: undefined,
				githubUserId: undefined,
				repositoryOwner: repository.owner,
				repositoryName: repository.name,
				branchName: undefined,
				articlePath: undefined,
				pullRequestNumber: pullRequestNumber,
				azureDevOpsId: undefined
			};
		const matches: SubmissionState[] = await this.stateStore.Find(query);

		if (matches.length > 1)
		{
			throw new StateCorrelationError("pull request " + pullRequestNumber.toString());
		}

		return matches[0];
	}

	/**
	 * Requires the exact event transition to exist in durable history before a
	 * message can claim that the business stage changed.
	 *
	 * @param state The correlated canonical state.
	 * @param transition The transition selected for notification.
	 */
	private RequireTransition(state: SubmissionState, transition: ReviewTransition): void
	{
		let transitionFound: boolean = false;

		for (const historyItem of state.reviewState.history)
		{
			if (historyItem.eventId === transition.eventId
				&& historyItem.fromStage === transition.fromStage
				&& historyItem.toStage === transition.toStage)
			{
				transitionFound = true;
			}
		}

		if (!transitionFound)
		{
			throw new StateCorrelationError(state.submissionId);
		}
	}

	/**
	 * Maps durable state and transition facts to a transport-neutral group-chat
	 * message with the direct GitHub pull-request URL.
	 *
	 * @param state The correlated canonical state.
	 * @param repository The base repository identity.
	 * @param pullRequestNumber The positive pull-request number.
	 * @param transition The accepted review transition.
	 * @returns The normalized stage handoff message.
	 */
	private CreateMessage(
		state: SubmissionState,
		repository: RepositoryTarget,
		pullRequestNumber: number,
		transition: ReviewTransition): StageMessage
	{
		const pullRequestUrl: string = this.CreateUrl(repository, pullRequestNumber);
		const message: StageMessage =
			{
				submissionId: state.submissionId,
				eventId: transition.eventId,
				action: transition.action,
				fromStage: transition.fromStage,
				toStage: transition.toStage,
				pullRequestUrl: pullRequestUrl
			};

		return message;
	}

	/**
	 * Builds the direct GitHub URL for one correlated pull request.
	 *
	 * @param repository The base repository identity.
	 * @param pullRequestNumber The positive pull-request number.
	 * @returns The encoded public GitHub pull-request URL.
	 */
	private CreateUrl(repository: RepositoryTarget, pullRequestNumber: number): string
	{
		const pullRequestUrl: string = "https://github.com/"
			+ encodeURIComponent(repository.owner)
			+ "/"
			+ encodeURIComponent(repository.name)
			+ "/pull/"
			+ pullRequestNumber.toString();

		return pullRequestUrl;
	}

	/**
	 * Saves successful delivery and reconciles one state conflict without sending
	 * the irreversible external message a second time.
	 *
	 * @param state The state revision used to authorize delivery.
	 * @param repository The correlated repository identity.
	 * @param pullRequestNumber The correlated pull-request number.
	 * @param transition The delivered transition.
	 * @param actionKey The stable Teams completion key.
	 */
	private async SaveCompletion(
		state: SubmissionState,
		repository: RepositoryTarget,
		pullRequestNumber: number,
		transition: ReviewTransition,
		actionKey: string): Promise<void>
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

			const currentState: SubmissionState = await this.FindState(repository, pullRequestNumber);
			this.RequireTransition(currentState, transition);

			if (!currentState.completedActions.includes(actionKey))
			{
				currentState.completedActions.push(actionKey);
				await this.stateStore.Save(currentState, currentState.revision);
			}
		}
	}
}