import type { OutputWriter } from "../ports/OutputWriter.js";

/**
 * Writes command-line application messages to the process console.
 * This adapter is intentionally small so console-specific behavior remains
 * outside the application service and can be replaced during tests.
 */
export class ConsoleWriter implements OutputWriter
{
	/**
	 * Writes one complete message to standard output for local runs and GitHub
	 * Actions logs. The adapter performs no formatting so application messages
	 * remain deterministic across execution environments.
	 *
	 * @param message The complete message to write to standard output.
	 */
	public Write(message: string): void
	{
		console.log(message);
	}
}