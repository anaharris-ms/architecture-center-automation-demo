import type { ApprovalMode } from "./ApprovalMode.js";
import type { SubmissionType } from "./SubmissionType.js";

/**
 * Describes a validated, non-mutating Azure DevOps User Story proposal. The
 * model contains pipeline-owned meaning rather than REST patch operations or
 * Azure DevOps field reference names, which remain responsibilities of Stage 5.
 */
export interface AzureDevOpsPlan
{
	/** The stable action key later used to make apply-mode creation idempotent. */
	actionKey: string;

	/** The stable submission identity used for cross-system correlation. */
	submissionId: string;

	/** The normalized contribution category that selected the estimate. */
	submissionType: SubmissionType;

	/** The proposed Azure DevOps work-item type. */
	workItemType: string;

	/** The proposed User Story title from the normalized submission. */
	title: string;

	/** The proposed User Story summary from the normalized submission. */
	summary: string;

	/** The GitHub repository owner included in the structured description. */
	repositoryOwner: string;

	/** The GitHub repository name included in the structured description. */
	repositoryName: string;

	/** The repository-relative article path included in acceptance criteria. */
	articlePath: string;

	/** The configured approver associated with the planned intake decision. */
	approver: string;

	/** The configured approval behavior applied to the submission. */
	approvalMode: ApprovalMode;

	/** The estimate selected by the normalized submission category. */
	storyPoints: number;
}