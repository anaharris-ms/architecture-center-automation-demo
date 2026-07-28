/**
 * Represents validated proposal content inside the pipeline. The proposal
 * remains independent of the presentation formats later used by Azure DevOps,
 * GitHub, email, and reports.
 */
export interface Proposal
{
	/** The concise, validated title for the proposed contribution. */
	title: string;

	/** The validated explanation of the content work being proposed. */
	summary: string;
}