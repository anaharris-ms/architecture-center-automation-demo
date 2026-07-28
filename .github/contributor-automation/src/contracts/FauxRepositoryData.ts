/**
 * Identifies the GitHub repository targeted by a faux submission. Owner and
 * name are separate so later adapters can construct API requests and links
 * without parsing a user-provided URL.
 */
export interface FauxRepositoryData
{
	/** The GitHub account or organization owning the target repository. */
	owner: string;

	/** The target GitHub repository name without an owner or URL. */
	name: string;
}