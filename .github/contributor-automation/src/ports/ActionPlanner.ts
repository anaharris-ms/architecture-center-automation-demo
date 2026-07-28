import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { IntakeConfig } from "../domain/IntakeConfig.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Defines non-mutating intake classification and Azure DevOps action planning.
 * Application orchestration can request a plan without knowing its rule
 * implementation or depending on a future Azure DevOps execution adapter.
 */
export interface ActionPlanner
{
	/**
	 * Creates one validated action plan from normalized submission and settings.
	 *
	 * @param submission The normalized contributor submission to classify.
	 * @param config The validated approval configuration to apply.
	 * @returns The typed non-mutating Azure DevOps action plan.
	 */
	Create(submission: Submission, config: IntakeConfig): AzureDevOpsPlan;
}