/**
 * Configures GitHub Contents API access for the dedicated submission-state
 * branch. The token is used only in request headers and is never persisted in
 * canonical submission state or diagnostic artifacts.
 */
export interface GitHubStateConfig
{
	/** The GitHub organization or account owning the automation repository. */
	owner: string;

	/** The automation repository containing the state branch. */
	repository: string;

	/** The dedicated branch containing canonical state documents. */
	branch: string;

	/** The GitHub token authorized to read and write repository contents. */
	token: string;
}