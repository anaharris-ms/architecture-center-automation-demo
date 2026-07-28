import type { ReviewTransition } from "./ReviewTransition.js";
import type { SubmissionStage } from "./SubmissionStage.js";

/**
 * Contains durable review orchestration facts for one submission. Drafting can
 * resume only technical or content review, while transition history preserves
 * completed approvals and explicit reopen decisions across workflow reruns.
 */
export interface ReviewState
{
	/** The review stage that contributor drafting must resume, when applicable. */
	resumeStage: SubmissionStage | undefined;

	/** The current PR head SHA against which the active review is evaluated. */
	openedCommitSha: string | undefined;

	/** Accepted stage transitions in durable chronological order. */
	history: ReviewTransition[];
}