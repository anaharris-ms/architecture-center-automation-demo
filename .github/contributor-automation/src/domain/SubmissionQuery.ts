/**
 * Describes supported correlation fields for locating submission state. Every
 * defined field is matched, which lets adapters narrow broad repository
 * searches without embedding GitHub-specific payloads in the store contract.
 */
export interface SubmissionQuery
{
	/** The stable submission identity when already known. */
	submissionId: string | undefined;

	/** The immutable numeric GitHub contributor identity when resolved. */
	githubUserId: number | undefined;

	/** The repository owner used for GitHub correlation. */
	repositoryOwner: string | undefined;

	/** The repository name used for GitHub correlation. */
	repositoryName: string | undefined;

	/** The contributor branch when it has been assigned. */
	branchName: string | undefined;

	/** The article path when matching an incoming contribution. */
	articlePath: string | undefined;

	/** The pull-request number when GitHub has assigned one. */
	pullRequestNumber: number | undefined;

	/** The Azure DevOps work-item identifier when it has been created. */
	azureDevOpsId: number | undefined;
}