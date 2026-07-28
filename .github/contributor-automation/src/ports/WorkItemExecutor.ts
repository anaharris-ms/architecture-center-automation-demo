import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { WorkItemResult } from "../domain/WorkItemResult.js";

/**
 * Defines idempotent execution of one validated Azure DevOps action plan without
 * exposing client lookup or creation operations to higher orchestration layers.
 */
export interface WorkItemExecutor
{
	/**
	 * Finds or creates the User Story represented by one validated plan.
	 *
	 * @param actionPlan The validated Stage 4 User Story proposal.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns The found-or-created work-item outcome.
	 */
	Execute(actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): Promise<WorkItemResult>;
}