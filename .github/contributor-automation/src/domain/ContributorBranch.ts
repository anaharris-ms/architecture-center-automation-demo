/**
 * Reports the durable contributor branch correlation established by branch
 * preparation without exposing GitHub REST response payloads to callers.
 */
export interface ContributorBranch
{
	/** The deterministic contributor branch associated with the submission. */
	branchName: string;

	/** The exact configured base-branch commit used when the branch was first prepared. */
	initialCommitSha: string;

	/** Whether this invocation created the external GitHub branch. */
	created: boolean;
}