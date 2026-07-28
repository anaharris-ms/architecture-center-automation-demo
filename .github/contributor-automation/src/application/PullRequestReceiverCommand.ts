import type { RepositoryTarget } from "../domain/RepositoryTarget.js";

/**
 * Represents one trusted automation-repository request to retrieve and process
 * a pull request. The command contains only routing identity; GitHub remains
 * authoritative for every contributor-authored and correlation-relevant fact.
 */
export interface PullRequestReceiverCommand
{
	/** The allowlisted contributor repository whose pull request is retrieved. */
	repository: RepositoryTarget;
	/** The positive GitHub pull-request number within the selected repository. */
	pullRequestNumber: number;
}