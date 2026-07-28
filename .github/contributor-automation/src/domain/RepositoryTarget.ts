/**
 * Represents a validated GitHub repository target inside the pipeline. The
 * split owner and name values allow adapters to create links and API requests
 * without reparsing user-provided repository URLs.
 */
export interface RepositoryTarget
{
	/** The GitHub account or organization owning the target repository. */
	owner: string;

	/** The target GitHub repository name. */
	name: string;
}