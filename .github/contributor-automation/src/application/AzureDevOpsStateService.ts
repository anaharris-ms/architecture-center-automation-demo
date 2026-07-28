import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { Submission } from "../domain/Submission.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { WorkItemResult } from "../domain/WorkItemResult.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import type { WorkItemApplier } from "../ports/WorkItemApplier.js";
import type { WorkItemExecutor } from "../ports/WorkItemExecutor.js";
import { StateCorrelationError } from "./StateCorrelationError.js";
import type { SubmissionStateFactory } from "./SubmissionStateFactory.js";

/**
 * Reconciles canonical submission state with idempotent Azure DevOps execution.
 * The external ID, completed action, and planned stage are persisted together;
 * reruns can recover a created item through duplicate lookup after save races.
 */
export class AzureDevOpsStateService implements WorkItemApplier
{
	private readonly stateStore: SubmissionStore;
	private readonly stateFactory: SubmissionStateFactory;
	private readonly workItemExecutor: WorkItemExecutor;

	/**
	 * Creates state-aware orchestration from persistence, factory, and execution
	 * boundaries.
	 *
	 * @param stateStore The canonical optimistic-concurrency state store.
	 * @param stateFactory The factory for first-time submission state.
	 * @param workItemExecutor The idempotent Azure DevOps action executor.
	 */
	public constructor(stateStore: SubmissionStore, stateFactory: SubmissionStateFactory, workItemExecutor: WorkItemExecutor)
	{
		this.stateStore = stateStore;
		this.stateFactory = stateFactory;
		this.workItemExecutor = workItemExecutor;
	}

	/**
	 * Reuses complete canonical correlation, repairs an ID missing its action key,
	 * or executes Azure DevOps before atomically saving all resulting state.
	 *
	 * @param submission The normalized submission owning canonical correlation.
	 * @param actionPlan The validated Stage 4 User Story proposal.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns The reused, found, or newly created work-item outcome.
	 */
	public async Apply(submission: Submission, actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): Promise<WorkItemResult>
	{
		let state: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);
		let expectedRevision: number | undefined = undefined;
		let workItemResult: WorkItemResult;

		if (state === undefined)
		{
			state = this.stateFactory.Create(submission);
		}
		else
		{
			expectedRevision = state.revision;
			this.Validate(state, submission);
		}

		if (state.azureDevOpsId !== undefined && state.completedActions.includes(actionPlan.actionKey))
		{
			workItemResult = this.GetResult(state.azureDevOpsId, false, actionPlan.actionKey);
		}
		else
		{
			if (state.azureDevOpsId !== undefined)
			{
				workItemResult = this.GetResult(state.azureDevOpsId, false, actionPlan.actionKey);
			}
			else
			{
				workItemResult = await this.workItemExecutor.Execute(actionPlan, config);
				state.azureDevOpsId = workItemResult.workItemId;
			}

			if (!state.completedActions.includes(actionPlan.actionKey))
			{
				state.completedActions.push(actionPlan.actionKey);
			}

			state.currentStage = SubmissionStage.Planned;
			await this.stateStore.Save(state, expectedRevision);
		}

		return workItemResult;
	}

	/**
	 * Validates that durable correlation still identifies the same submission
	 * content before an external ID can be reused or changed.
	 *
	 * @param state The loaded canonical state record.
	 * @param submission The current normalized submission.
	 */
	private Validate(state: SubmissionState, submission: Submission): void
	{
		const ownerMatches: boolean = state.repository.owner === submission.repository.owner;
		const repositoryMatches: boolean = state.repository.name === submission.repository.name;
		const articleMatches: boolean = state.articlePath === submission.articlePath;

		if (!ownerMatches || !repositoryMatches || !articleMatches)
		{
			throw new StateCorrelationError(submission.submissionId);
		}
	}

	/**
	 * Creates a work-item outcome without calling the external client.
	 *
	 * @param workItemId The canonical Azure DevOps work-item identifier.
	 * @param created Whether this execution created the item.
	 * @param actionKey The stable completed-action key.
	 * @returns A complete work-item execution result.
	 */
	private GetResult(workItemId: number, created: boolean, actionKey: string): WorkItemResult
	{
		const result: WorkItemResult =
			{
				workItemId: workItemId,
				created: created,
				actionKey: actionKey
			};

		return result;
	}
}