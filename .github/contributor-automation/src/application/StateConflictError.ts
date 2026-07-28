/**
 * Reports an optimistic concurrency conflict when stored submission state has
 * changed since an operation loaded it. Callers must reload and reconcile the
 * newer state instead of overwriting completed actions or external links.
 */
export class StateConflictError extends Error
{
	/**
	 * Creates a conflict error for one stable contributor submission.
	 *
	 * @param submissionId The identity whose stored revision did not match.
	 */
	public constructor(submissionId: string)
	{
		super("Submission state changed before save: " + submissionId + ".");
		this.name = "StateConflictError";
	}
}