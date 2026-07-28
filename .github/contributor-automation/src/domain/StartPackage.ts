/**
 * Represents the deterministic contributor-facing values used by every Stage
 * 6 delivery format. Keeping links and instructions in a repository-owned
 * model prevents HTML email details from becoming application behavior.
 */
export interface StartPackage
{
	/** The stable submission identity shown throughout the instructions. */
	submissionId: string;

	/** The deterministic contributor branch associated with the submission. */
	branchName: string;

	/** The GitHub web editor entry point for the target repository. */
	webEditorUrl: string;

	/** The HTTPS repository URL used by local VS Code instructions. */
	repositoryUrl: string;

	/** The repository-relative article path the contributor must edit. */
	articlePath: string;

	/** The required pull-request title containing durable correlation. */
	pullRequestTitle: string;

	/** The internal Azure DevOps work-item URL for the acknowledged proposal. */
	workItemUrl: string;
}