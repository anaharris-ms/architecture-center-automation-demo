/**
 * Reports a GitHub review action that is valid in shape but not permitted from
 * the submission's current business stage. The message intentionally excludes
 * external payload bodies and credentials.
 */
export class ReviewTransitionError extends Error
{
	/**
	 * Creates one stable transition failure for workflow diagnostics.
	 *
	 * @param message The sanitized reason the transition was rejected.
	 */
	public constructor(message: string)
	{
		super(message);
		this.name = "ReviewTransitionError";
	}
}