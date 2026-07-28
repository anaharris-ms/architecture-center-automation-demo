import type { ReviewAction } from "./ReviewAction.js";
import type { SubmissionStage } from "./SubmissionStage.js";

/**
 * Contains normalized review-stage handoff context sent to the Power Automate
 * flow configured for the internal p&p group chat. No reviewer identity mapping
 * or Teams mention is included in the current contract.
 */
export interface StageMessage
{
	/** The stable submission identity shown in the group-chat announcement. */
	submissionId: string;

	/** The accepted GitHub event identity used to correlate delivery. */
	eventId: string;

	/** The GitHub action that caused the stage change. */
	action: ReviewAction;

	/** The stage completed or left by the accepted action. */
	fromStage: SubmissionStage;

	/** The newly active business stage announced to the group. */
	toStage: SubmissionStage;

	/** The direct HTTPS URL to the pull request where reviewers are assigned. */
	pullRequestUrl: string;
}