import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { Submission } from "../domain/Submission.js";
import type { WorkItemResult } from "../domain/WorkItemResult.js";

/**
 * Defines state-aware application of a planned Azure DevOps User Story action.
 */
export interface WorkItemApplier
{
	/**
	 * Reconciles canonical state and Azure DevOps for one contributor submission.
	 *
	 * @param submission The normalized submission owning canonical correlation.
	 * @param actionPlan The validated Stage 4 User Story proposal.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns The reused, found, or newly created work-item outcome.
	 */
	Apply(submission: Submission, actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): Promise<WorkItemResult>;
}