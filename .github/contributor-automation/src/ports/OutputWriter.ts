/**
 * Defines the output behavior required by the command-line application.
 * Keeping output behind this port prevents application orchestration from
 * depending on the console and allows tests to observe messages directly.
 */
export interface OutputWriter
{
	/**
	 * Writes one application message to the configured output destination.
	 * Implementations may write to the console, a test buffer, or a structured
	 * workflow log without changing the application service.
	 *
	 * @param message The complete message to write.
	 */
	Write(message: string): void;
}