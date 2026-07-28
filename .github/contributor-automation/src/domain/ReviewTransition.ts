import type { ReviewAction } from "./ReviewAction.js";
import type { SubmissionStage } from "./SubmissionStage.js";

/**
 * Records one accepted GitHub-driven stage transition. The actor is retained
 * only as audit evidence; this contract does not map people to reviewer roles
 * or use identity to decide which review stage is active.
 */
export interface ReviewTransition
{
	/** The stable GitHub event identity used to deduplicate workflow reruns. */
	eventId: string;

	/** The explicit GitHub action accepted by the transition service. */
	action: ReviewAction;

	/** The business stage active immediately before the transition. */
	fromStage: SubmissionStage;

	/** The business stage active immediately after the transition. */
	toStage: SubmissionStage;

	/** The GitHub login retained for audit evidence only. */
	githubActor: string;

	/** The full PR head commit SHA to which the event applies. */
	commitSha: string;

	/** The authoritative GitHub event timestamp in ISO 8601 form. */
	recordedAt: string;
}