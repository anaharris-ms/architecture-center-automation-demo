import type { Submission } from "../domain/Submission.js";

/**
 * Defines application behavior for loading one validated and normalized
 * submission. CLI orchestration depends on this port rather than file or JSON
 * details so tests and future intake adapters remain replaceable.
 */
export interface SubmissionLoader
{
	/**
	 * Loads, validates, and normalizes one external submission record.
	 *
	 * @param sourcePath The source-specific path identifying the intake record.
	 * @returns The pipeline-owned normalized submission.
	 */
	Load(sourcePath: string): Submission;
}