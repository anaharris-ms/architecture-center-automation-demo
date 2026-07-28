import type { PipelineCommand } from "../application/PipelineCommand.js";
import { ExecutionMode } from "../domain/ExecutionMode.js";
import type { CommandResult } from "./CommandResult.js";

/**
 * Converts raw process arguments into a validated pipeline command. The parser
 * owns command-line vocabulary so application and domain classes never inspect
 * positional strings or depend directly on the Node.js process object.
 */
export class CommandParser
{
	/**
	 * Parses one execution mode, faux submission path, and configuration path. Missing,
	 * additional, and unsupported arguments return an actionable error instead
	 * of allowing an ambiguous pipeline execution or intake source.
	 *
	 * @param commandArguments The arguments following the CLI entry-point name.
	 * @returns A validated command or a user-facing parsing error.
	 */
	public Parse(commandArguments: string[]): CommandResult
	{
		let command: PipelineCommand | undefined = undefined;
		let errorMessage: string | undefined = undefined;

		if (commandArguments.length !== 5)
		{
			errorMessage = "Usage: <plan|apply> --submission <file> --config <file>.";
		}
		else
		{
			const modeArgument: string | undefined = commandArguments[0];
			const submissionFlag: string | undefined = commandArguments[1];
			const submissionPath: string | undefined = commandArguments[2];
			const configFlag: string | undefined = commandArguments[3];
			const configPath: string | undefined = commandArguments[4];

			if (submissionFlag !== "--submission" || submissionPath === undefined || submissionPath.trim().length === 0 || configFlag !== "--config" || configPath === undefined || configPath.trim().length === 0)
			{
				errorMessage = "Usage: <plan|apply> --submission <file> --config <file>.";
			}
			else if (modeArgument === ExecutionMode.Plan)
			{
				command = this.CreateCommand(ExecutionMode.Plan, submissionPath, configPath);
			}
			else if (modeArgument === ExecutionMode.Apply)
			{
				command = this.CreateCommand(ExecutionMode.Apply, submissionPath, configPath);
			}
			else
			{
				errorMessage = "Unsupported execution mode. Use plan or apply.";
			}
		}

		const result: CommandResult =
			{
				command: command,
				errorMessage: errorMessage
			};

		return result;
	}

	/**
	 * Creates the application command after the execution mode has been
	 * validated. This method centralizes command construction so later command
	 * fields can be added without duplicating object creation across branches.
	 *
	 * @param mode The validated execution mode selected by the user.
	 * @param submissionPath The validated faux intake file path.
	 * @param configPath The validated intake-rule configuration path.
	 * @returns A command ready for application dispatch.
	 */
	private CreateCommand(mode: ExecutionMode, submissionPath: string, configPath: string): PipelineCommand
	{
		const command: PipelineCommand =
			{
				mode: mode,
				submissionPath: submissionPath,
				configPath: configPath
			};

		return command;
	}
}