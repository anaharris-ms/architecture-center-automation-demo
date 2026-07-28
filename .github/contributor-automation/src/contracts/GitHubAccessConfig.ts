/**
 * Contains authentication required by the GitHub contributor-access adapter.
 * The token is supplied at runtime and must never be written to URLs, state,
 * logs, workflow output, or repository-owned configuration.
 */
export interface GitHubAccessConfig
{
	/** A short-lived GitHub token authorized for the target repository. */
	token: string;
}
