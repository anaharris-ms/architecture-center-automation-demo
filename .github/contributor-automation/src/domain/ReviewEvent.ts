import type { RepositoryTarget } from "./RepositoryTarget.js";
import type { ReviewAction } from "./ReviewAction.js";

/**
 * Represents one validated GitHub event that may change review progression.
 * The maintainer flag is relevant only to explicit reopen commands and is
 * supplied by a repository-permission adapter rather than contributor input.
 */
export interface ReviewEvent
{
	/** The stable event identity used to make workflow reruns idempotent. */
	eventId: string;

	/** The GitHub action translated into the pipeline review vocabulary. */
	action: ReviewAction;

	/** The base repository containing the correlated pull request. */
	repository: RepositoryTarget;

	/** The positive pull-request number within the base repository. */
	pullRequestNumber: number;

	/** The GitHub login retained as audit evidence. */
	githubActor: string;

	/** The authoritative current full pull-request head SHA. */
	commitSha: string;

	/** The authoritative GitHub event timestamp in ISO 8601 form. */
	recordedAt: string;

	/** Whether GitHub reports maintain or admin access for a reopen actor. */
	maintainerAuthorized: boolean;
}