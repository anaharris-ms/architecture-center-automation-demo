/**
 * Defines contributor identity as supplied by the faux intake boundary. The
 * contract contains only the identity needed to communicate with the
 * contributor and match a future GitHub pull request.
 */
export interface FauxContributorData
{
	/** The contributor's display name for human-readable tracking. */
	name: string;

	/** The contributor's email address for future notifications. */
	email: string;

	/** The GitHub username used to help match the contributor's pull request. */
	githubUsername: string;
}