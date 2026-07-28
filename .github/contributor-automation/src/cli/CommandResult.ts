import type { PipelineCommand } from "../application/PipelineCommand.js";

/**
 * Describes the result of converting command-line arguments into an
 * application command. The parser returns either a command or an actionable
 * error so invalid user input does not enter the application layer.
 */
export interface CommandResult
{
	/**
	 * Contains the validated application command when parsing succeeds. A failed
	 * parse leaves this value undefined and provides an error message instead.
	 */
	command: PipelineCommand | undefined;

	/**
	 * Contains a user-facing explanation when parsing fails. A successful parse
	 * leaves this value undefined because no error needs to be displayed.
	 */
	errorMessage: string | undefined;
}