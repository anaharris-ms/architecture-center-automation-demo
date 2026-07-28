/**
 * Represents validated contributor identity inside the pipeline. Domain and
 * application services use this model instead of reading faux intake or GitHub
 * payload structures directly.
 */
export interface Contributor
{
	/** The contributor's display name for internal and external communication. */
	name: string;

	/** The validated email address used by notification adapters. */
	email: string;

	/** The validated GitHub username used for pull-request matching. */
	githubUsername: string;
}