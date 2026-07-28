import type { StartConfig } from "../domain/StartConfig.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Defines presentation of one validated start package as a complete email
 * document. Implementations may format MIME without changing application
 * orchestration or the repository-owned contributor instruction model.
 */
export interface EmailRenderer
{
	/**
	 * Renders a complete email artifact without sending it or changing state.
	 *
	 * @param submission The validated contributor submission.
	 * @param startPackage The deterministic Stage 6 instruction values.
	 * @param config The validated sender, guidance, asset, and output settings.
	 * @returns A complete RFC-style email document ready for artifact storage.
	 */
	Render(submission: Submission, startPackage: StartPackage, config: StartConfig): string;
}