/**
 * Reports that a revision-aware content service rejected a stale write. The
 * durable submission store converts this transport-neutral error into the
 * state conflict exposed by the SubmissionStore contract.
 */
export class ContentConflictError extends Error
{
	/**
	 * Creates a conflict error for one repository-relative content path.
	 *
	 * @param contentPath The document path whose revision no longer matched.
	 */
	public constructor(contentPath: string)
	{
		super("Content changed before it could be saved: " + contentPath);
		this.name = "ContentConflictError";
	}
}