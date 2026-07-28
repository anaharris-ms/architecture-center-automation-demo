import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Defines state-aware generation of the Stage 6 contributor email artifact.
 */
export interface StartPackageApplier
{
	/**
	 * Generates the deterministic artifact and records package correlation.
	 *
	 * @param submission The normalized contributor submission.
	 * @param azureDevOpsConfig The correlated tracking destination.
	 * @param startConfig The validated delivery configuration.
	 * @returns The local artifact path generated for workflow publication.
	 */
	Apply(submission: Submission, azureDevOpsConfig: AzureDevOpsConfig, startConfig: StartConfig): Promise<string>;
}