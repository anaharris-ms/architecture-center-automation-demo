import type { ReminderRecord } from "./ReminderRecord.js";
import type { RepositoryTarget } from "./RepositoryTarget.js";
import type { ReviewAssignments } from "./ReviewAssignments.js";
import type { ReviewState } from "./ReviewState.js";
import type { SubmissionStage } from "./SubmissionStage.js";

/**
 * Represents the canonical, durable correlation record for one contributor
 * submission. External identifiers remain optional until their corresponding
 * pipeline actions complete, while the submission identity and content target
 * are available from intake onward.
 */
export interface SubmissionState
{
	/** The stable pipeline identity shared by all external systems. */
	submissionId: string;

	/** The Azure DevOps work-item identifier after work-item creation. */
	azureDevOpsId: number | undefined;

	/** The immutable numeric GitHub identity after eligibility verification. */
	githubUserId: number | undefined;

	/** The GitHub repository receiving the contributor change. */
	repository: RepositoryTarget;

	/** The contributor branch after start-work instructions are generated. */
	branchName: string | undefined;

	/** The base commit selected before the contributor branch is created. */
	initialCommitSha: string | undefined;

	/** The repository-relative Markdown path associated with the submission. */
	articlePath: string;

	/** The GitHub pull-request number after a matching request is detected. */
	pullRequestNumber: number | undefined;

	/** The current pipeline-owned business stage. */
	currentStage: SubmissionStage;

	/** Durable GitHub review progression, resume intent, and audit evidence. */
	reviewState: ReviewState;

	/** The people currently assigned to review and publishing stages. */
	assignments: ReviewAssignments;

	/** Stable action keys already completed by apply-mode operations. */
	completedActions: string[];

	/** Reminder outcomes used to deduplicate follow-up actions. */
	reminderHistory: ReminderRecord[];

	/** The optimistic concurrency revision assigned by the state store. */
	revision: number;
}