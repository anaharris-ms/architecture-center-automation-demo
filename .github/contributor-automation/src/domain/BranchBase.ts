/**
 * Identifies the exact configured repository branch commit selected as the
 * base for a contributor branch. The application persists the immutable commit
 * SHA before mutation so retries do not silently move to a newer commit.
 */
export interface BranchBase
{
	/** The configured contribution base branch name. */
	branchName: string;

	/** The full commit SHA currently referenced by the configured base branch. */
	commitSha: string;
}