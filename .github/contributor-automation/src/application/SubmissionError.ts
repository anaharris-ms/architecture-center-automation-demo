/**
 * Reports a faux submission that cannot enter the pipeline. The error combines
 * all boundary findings so a user can correct the intake fixture in one pass
 * instead of discovering invalid fields across repeated workflow runs.
 */
export class SubmissionError extends Error
{
	/**
	 * Creates an application error from ordered validation findings.
	 *
	 * @param errors The actionable boundary errors found in the faux intake.
	 */
	public constructor(errors: string[])
	{
		const message: string = "Submission validation failed: " + errors.join(" ");
		super(message);
		this.name = "SubmissionError";
	}
}