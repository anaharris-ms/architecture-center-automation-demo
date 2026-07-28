/**
 * Reports ambiguous Azure DevOps correlation when more than one User Story
 * claims the same stable submission identity. The pipeline fails instead of
 * guessing which external record is authoritative.
 */
export class DuplicateWorkItemError extends Error
{
	/**
	 * Creates an ambiguity error containing the stable submission identity.
	 *
	 * @param submissionId The identity associated with multiple work items.
	 */
	public constructor(submissionId: string)
	{
		super("Multiple Azure DevOps User Stories match " + submissionId + ".");
		this.name = "DuplicateWorkItemError";
	}
}