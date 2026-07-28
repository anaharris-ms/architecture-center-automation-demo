import type { RepositoryTarget } from "./RepositoryTarget.js";

/**
 * Represents repository-owned facts about one opened GitHub pull request.
 * A future GitHub adapter will validate the event payload and enrich it with
 * changed file paths before constructing this transport-independent model.
 */
export interface PullRequestObservation
{
	/** The positive GitHub pull-request number within the target repository. */
	pullRequestNumber: number;

	/** The immutable numeric GitHub identity of the pull-request author. */
	authorUserId: number;

	/** The base repository that will receive the proposed changes. */
	repository: RepositoryTarget;

	/** The contributor's source branch name without a Git ref prefix. */
	headBranch: string;

	/** The authoritative full commit SHA currently at the pull-request head. */
	headCommitSha: string;

	/** The current contributor-authored pull-request title. */
	title: string;

	/** The current contributor-authored body, or an empty string when absent. */
	body: string;

	/** The repository-relative paths changed by the pull request. */
	changedPaths: string[];
}