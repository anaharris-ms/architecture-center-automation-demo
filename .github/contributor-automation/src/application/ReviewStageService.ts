import { ReviewAction } from "../domain/ReviewAction.js";
import type { ReviewEvent } from "../domain/ReviewEvent.js";
import type { ReviewTransition } from "../domain/ReviewTransition.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import { ReviewTransitionError } from "./ReviewTransitionError.js";
import { StateCorrelationError } from "./StateCorrelationError.js";

/**
 * Applies deterministic GitHub review, revision, reopen, and merge events to
 * canonical state. GitHub owns reviewer selection; this service uses the active
 * stage as context and retains the actor only as audit evidence.
 */
export class ReviewStageService
{
	private readonly stateStore: SubmissionStore;

	/**
	 * Creates review progression over the optimistic-concurrency state boundary.
	 *
	 * @param stateStore The canonical submission state store.
	 */
	public constructor(stateStore: SubmissionStore)
	{
		this.stateStore = stateStore;
	}

	/**
	 * Correlates one PR event, returns an existing transition on duplicate event
	 * delivery, validates the stage rule, and saves exactly one new audit record.
	 *
	 * @param event The validated authoritative GitHub review event.
	 * @returns The accepted new or previously persisted transition.
	 */
	public async Apply(event: ReviewEvent): Promise<ReviewTransition>
	{
		this.Validate(event);
		const state: SubmissionState = await this.FindState(event);
		const existingTransition: ReviewTransition | undefined = this.FindEvent(state, event.eventId);
		let transition: ReviewTransition;

		if (existingTransition !== undefined)
		{
			transition = existingTransition;
		}
		else
		{
			transition = this.CreateTransition(state, event);
			state.currentStage = transition.toStage;
			state.reviewState.openedCommitSha = event.commitSha;
			state.reviewState.history.push(transition);
			await this.stateStore.Save(state, state.revision);
		}

		return transition;
	}

	/**
	 * Builds the exact state query and requires one canonical PR correlation.
	 *
	 * @param event The event containing repository and pull-request identity.
	 * @returns The sole correlated submission state.
	 */
	private async FindState(event: ReviewEvent): Promise<SubmissionState>
	{
		const query: SubmissionQuery =
			{
				submissionId: undefined,
				githubUserId: undefined,
				repositoryOwner: event.repository.owner,
				repositoryName: event.repository.name,
				branchName: undefined,
				articlePath: undefined,
				pullRequestNumber: event.pullRequestNumber,
				azureDevOpsId: undefined
			};
		const matches: SubmissionState[] = await this.stateStore.Find(query);

		if (matches.length !== 1)
		{
			throw new StateCorrelationError("pull request " + event.pullRequestNumber.toString());
		}

		const state: SubmissionState | undefined = matches[0];

		if (state === undefined)
		{
			throw new StateCorrelationError("pull request " + event.pullRequestNumber.toString());
		}

		return state;
	}

	/**
	 * Finds a previously accepted event so GitHub workflow reruns cannot append a
	 * duplicate transition or send the state through a second business stage.
	 *
	 * @param state The correlated canonical submission state.
	 * @param eventId The stable GitHub event identity.
	 * @returns The existing transition, or undefined for a new event.
	 */
	private FindEvent(state: SubmissionState, eventId: string): ReviewTransition | undefined
	{
		let matchingTransition: ReviewTransition | undefined = undefined;

		for (const transition of state.reviewState.history)
		{
			if (transition.eventId === eventId)
			{
				matchingTransition = transition;
			}
		}

		return matchingTransition;
	}

	/**
	 * Selects the next stage for one new action and constructs its immutable audit
	 * record only after every stage, commit, and permission rule passes.
	 *
	 * @param state The current correlated canonical state.
	 * @param event The new validated GitHub event.
	 * @returns The accepted transition record.
	 */
	private CreateTransition(state: SubmissionState, event: ReviewEvent): ReviewTransition
	{
		let nextStage: SubmissionStage;

		if (event.action === ReviewAction.Approved)
		{
			this.RequireCurrentCommit(state, event);
			nextStage = this.GetApprovedStage(state);
			state.reviewState.resumeStage = undefined;
		}
		else if (event.action === ReviewAction.ChangesRequested)
		{
			this.RequireCurrentCommit(state, event);
			nextStage = this.GetDraftStage(state);
		}
		else if (event.action === ReviewAction.RevisionSubmitted)
		{
			nextStage = this.GetResumeStage(state);
			state.reviewState.resumeStage = undefined;
		}
		else if (event.action === ReviewAction.TechnicalReopened)
		{
			this.RequireMaintainer(event);
			this.RequireReopen(state, SubmissionStage.TechnicalReview);
			nextStage = SubmissionStage.TechnicalReview;
			state.reviewState.resumeStage = undefined;
		}
		else if (event.action === ReviewAction.ContentReopened)
		{
			this.RequireMaintainer(event);
			this.RequireReopen(state, SubmissionStage.ContentReview);
			nextStage = SubmissionStage.ContentReview;
			state.reviewState.resumeStage = undefined;
		}
		else
		{
			nextStage = this.GetMergeStage(state);
			state.reviewState.resumeStage = undefined;
		}

		const transition: ReviewTransition =
			{
				eventId: event.eventId,
				action: event.action,
				fromStage: state.currentStage,
				toStage: nextStage,
				githubActor: event.githubActor,
				commitSha: event.commitSha.toLowerCase(),
				recordedAt: event.recordedAt
			};

		return transition;
	}

	/**
	 * Advances formal approvals through technical, content, and editorial gates.
	 * A reopened technical review skips content only when content still has a
	 * sealed approval; an explicit content reopen clears that seal.
	 *
	 * @param state The current submission state.
	 * @returns The next deterministic business stage.
	 */
	private GetApprovedStage(state: SubmissionState): SubmissionStage
	{
		let nextStage: SubmissionStage;

		if (state.currentStage === SubmissionStage.TechnicalReview)
		{
			if (this.ContentSealed(state))
			{
				nextStage = SubmissionStage.EditorialReview;
			}
			else
			{
				nextStage = SubmissionStage.ContentReview;
			}
		}
		else if (state.currentStage === SubmissionStage.ContentReview)
		{
			nextStage = SubmissionStage.EditorialReview;
		}
		else if (state.currentStage === SubmissionStage.EditorialReview)
		{
			nextStage = SubmissionStage.Publishing;
		}
		else
		{
			throw new ReviewTransitionError("The current stage cannot be approved.");
		}

		return nextStage;
	}

	/**
	 * Moves only contributor-facing review stages into drafting and remembers the
	 * exact stage that must resume after the contributor pushes a revision.
	 *
	 * @param state The current submission state.
	 * @returns The drafting stage.
	 */
	private GetDraftStage(state: SubmissionState): SubmissionStage
	{
		const contributorReview: boolean = state.currentStage === SubmissionStage.TechnicalReview
			|| state.currentStage === SubmissionStage.ContentReview;

		if (!contributorReview)
		{
			throw new ReviewTransitionError("Only technical or content review can return to drafting.");
		}

		state.reviewState.resumeStage = state.currentStage;

		return SubmissionStage.Drafting;
	}

	/**
	 * Resumes the review that requested contributor changes after a new PR commit.
	 *
	 * @param state The drafting submission state.
	 * @returns The remembered technical or content review stage.
	 */
	private GetResumeStage(state: SubmissionState): SubmissionStage
	{
		if (state.currentStage !== SubmissionStage.Drafting || state.reviewState.resumeStage === undefined)
		{
			throw new ReviewTransitionError("A revision can resume only contributor drafting.");
		}

		return state.reviewState.resumeStage;
	}

	/**
	 * Requires publishing before a merged pull request completes pipeline scope.
	 *
	 * @param state The current submission state.
	 * @returns The terminal complete stage.
	 */
	private GetMergeStage(state: SubmissionState): SubmissionStage
	{
		if (state.currentStage !== SubmissionStage.Publishing)
		{
			throw new ReviewTransitionError("A pull request can complete only from publishing.");
		}

		return SubmissionStage.Complete;
	}

	/**
	 * Determines whether the latest content-review decision remains sealed.
	 * Explicit content reopening clears an earlier approval until content receives
	 * another formal approval.
	 *
	 * @param state The state whose durable history is being evaluated.
	 * @returns True when content review currently has an effective approval.
	 */
	private ContentSealed(state: SubmissionState): boolean
	{
		let sealed: boolean = false;

		for (const transition of state.reviewState.history)
		{
			if (transition.action === ReviewAction.ContentReopened)
			{
				sealed = false;
			}
			else if (transition.action === ReviewAction.Approved
				&& transition.fromStage === SubmissionStage.ContentReview)
			{
				sealed = true;
			}
		}

		return sealed;
	}

	/**
	 * Requires an explicit reopen to target an already completed earlier stage
	 * from a later internal review or publishing stage.
	 *
	 * @param state The current submission state.
	 * @param targetStage The technical or content stage requested by the label.
	 */
	private RequireReopen(state: SubmissionState, targetStage: SubmissionStage): void
	{
		const currentStage: SubmissionStage = state.currentStage;
		let allowed: boolean = false;

		if (targetStage === SubmissionStage.TechnicalReview)
		{
			allowed = currentStage === SubmissionStage.ContentReview
				|| currentStage === SubmissionStage.EditorialReview
				|| currentStage === SubmissionStage.Publishing;
		}
		else if (targetStage === SubmissionStage.ContentReview)
		{
			allowed = currentStage === SubmissionStage.EditorialReview
				|| currentStage === SubmissionStage.Publishing;
		}

		if (!allowed)
		{
			throw new ReviewTransitionError("The requested review stage cannot be reopened from the current stage.");
		}
	}

	/**
	 * Requires the approval or change request to target the exact current PR head.
	 *
	 * @param state The current submission state.
	 * @param event The review event containing its authoritative commit SHA.
	 */
	private RequireCurrentCommit(state: SubmissionState, event: ReviewEvent): void
	{
		if (state.reviewState.openedCommitSha === undefined
			|| state.reviewState.openedCommitSha !== event.commitSha.toLowerCase())
		{
			throw new ReviewTransitionError("The review does not apply to the current pull-request commit.");
		}
	}

	/**
	 * Requires GitHub maintain or admin permission for an explicit reopen command.
	 *
	 * @param event The reopen event carrying repository permission evidence.
	 */
	private RequireMaintainer(event: ReviewEvent): void
	{
		if (!event.maintainerAuthorized)
		{
			throw new ReviewTransitionError("Only a repository maintainer can reopen a review stage.");
		}
	}

	/**
	 * Defends the application boundary against malformed routing, event identity,
	 * actor, SHA, and timestamp values before querying or mutating state.
	 *
	 * @param event The untrusted adapter output to validate.
	 */
	private Validate(event: ReviewEvent): void
	{
		const actionValues: string[] = Object.values(ReviewAction);
		const actionValid: boolean = actionValues.includes(event.action);
		const numberValid: boolean = Number.isSafeInteger(event.pullRequestNumber) && event.pullRequestNumber > 0;
		const repositoryValid: boolean = event.repository.owner.trim().length > 0 && event.repository.name.trim().length > 0;
		const identityValid: boolean = event.eventId.trim().length > 0 && event.githubActor.trim().length > 0;
		const shaValid: boolean = /^[0-9a-fA-F]{40}$/.test(event.commitSha);
		const timestampValid: boolean = Number.isFinite(Date.parse(event.recordedAt));

		if (!actionValid || !numberValid || !repositoryValid || !identityValid || !shaValid || !timestampValid)
		{
			throw new ReviewTransitionError("The GitHub review event is invalid.");
		}
	}
}