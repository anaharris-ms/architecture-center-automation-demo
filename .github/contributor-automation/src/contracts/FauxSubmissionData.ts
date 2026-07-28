import type { FauxContributorData } from "./FauxContributorData.js";
import type { FauxProposalData } from "./FauxProposalData.js";
import type { FauxRepositoryData } from "./FauxRepositoryData.js";

/**
 * Defines the complete JSON payload accepted from the hackathon's faux intake.
 * The sequence number represents an intake-system allocation and is converted
 * into a stable submission ID when the payload enters the application.
 */
export interface FauxSubmissionData
{
	/** A positive intake sequence used to generate the stable submission ID. */
	submissionNumber: number;

	/** The contributor identity required for communication and PR matching. */
	contributor: FauxContributorData;

	/** The declared kind of content contribution being proposed. */
	submissionType: string;

	/** The target GitHub repository expressed without an external API payload. */
	repository: FauxRepositoryData;

	/** The repository-relative Markdown path being updated or proposed. */
	articlePath: string;

	/** The human-authored title and summary describing the contribution. */
	proposal: FauxProposalData;
}