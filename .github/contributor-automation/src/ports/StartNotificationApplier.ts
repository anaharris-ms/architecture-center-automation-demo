import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Defines apply-mode delivery of one state-correlated contributor start
 * notification without exposing Power Automate transport to orchestration.
 */
export interface StartNotificationApplier
{
	/**
	 * Delivers the private Teams message and records successful completion.
	 *
	 * @param submission The validated internal contributor submission.
	 * @param azureDevOpsConfig The validated tracking destination configuration.
	 * @param startConfig The validated contributor guidance configuration.
	 */
	Apply(
		submission: Submission,
		azureDevOpsConfig: AzureDevOpsConfig,
		startConfig: StartConfig): Promise<void>;
}