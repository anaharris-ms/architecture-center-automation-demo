/**
 * Contains the validated contribution context sent to the Power Automate cloud
 * flow responsible for posting one private Teams start message as Flow bot.
 * The model is independent of Power Automate and Teams connector payloads so
 * presentation can evolve in Microsoft 365 without changing pipeline rules.
 */
export interface StartMessage
{
	/** The stable submission identity shown in the Teams message. */
	submissionId: string;

	/** The internal Microsoft email address used to resolve the Teams recipient. */
	recipientEmail: string;

	/** The contributor display name used in the private message. */
	recipientName: string;

	/** The approved proposal title associated with the contribution. */
	proposalTitle: string;

	/** The existing deterministic contributor branch. */
	branchName: string;

	/** The requested repository-relative article path. */
	articlePath: string;

	/** The branch-specific github.dev start link. */
	webEditorUrl: string;

	/** The HTTPS repository URL for local VS Code work. */
	repositoryUrl: string;

	/** The required pull-request title containing submission correlation. */
	pullRequestTitle: string;

	/** The correlated Azure DevOps tracking item link. */
	workItemUrl: string;

	/** The configured internal sign-in guidance link. */
	idWebUrl: string;

	/** The configured repository-access support link. */
	accessHelpUrl: string;

	/** The configured contribution-options guidance link. */
	contributionOptionsUrl: string;
}