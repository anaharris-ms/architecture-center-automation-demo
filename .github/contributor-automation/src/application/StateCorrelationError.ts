/**
 * Reports canonical state whose stable identity points to different repository
 * content than the current normalized submission. Apply fails instead of
 * overwriting durable cross-system correlation.
 */
export class StateCorrelationError extends Error
{
	/**
	 * Creates an actionable state-correlation failure.
	 *
	 * @param submissionId The stable identity associated with conflicting state.
	 */
	public constructor(submissionId: string)
	{
		super("Canonical state correlation does not match submission " + submissionId + ".");
		this.name = "StateCorrelationError";
	}
}