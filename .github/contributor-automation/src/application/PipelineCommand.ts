import type { ExecutionMode } from "../domain/ExecutionMode.js";

/**
 * Represents a validated request to run the pipeline in one execution mode.
 * Later stages can extend the command with validated submission references
 * while the application continues to receive a repository-owned contract.
 */
export interface PipelineCommand
{
	/**
	 * Selects preview-only planning or idempotent action execution. Command-line
	 * parsing guarantees this value is valid before application behavior starts.
	 */
	mode: ExecutionMode;

	/**
	 * Identifies the faux intake file that must be validated and normalized
	 * before the selected execution mode can continue.
	 */
	submissionPath: string;

	/**
	 * Identifies the external intake-rule configuration that must be validated
	 * before approval behavior and Azure DevOps planning can continue.
	 */
	configPath: string;
}