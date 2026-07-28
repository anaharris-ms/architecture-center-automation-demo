import type { Contributor } from "./Contributor.js";
import type { Proposal } from "./Proposal.js";
import type { RepositoryTarget } from "./RepositoryTarget.js";
import type { SubmissionType } from "./SubmissionType.js";

/**
 * Represents one normalized and validated contributor submission. This is the
 * pipeline-owned contract used by application services and later persisted in
 * the submission state store; it contains no Azure DevOps or GitHub payloads.
 */
export interface Submission
{
	/** The stable pipeline identity generated from the intake sequence. */
	submissionId: string;

	/** The contributor associated with this submission. */
	contributor: Contributor;

	/** The normalized category of content contribution. */
	submissionType: SubmissionType;

	/** The validated GitHub repository receiving the contribution. */
	repository: RepositoryTarget;

	/** The validated repository-relative Markdown article path. */
	articlePath: string;

	/** The validated human-authored proposal details. */
	proposal: Proposal;
}