/**
 * Defines the proposal details supplied through faux intake. These values
 * describe the requested content work without embedding Azure DevOps fields or
 * GitHub event structures in the submission contract.
 */
export interface FauxProposalData
{
	/** The concise proposal title used in work-item and pull-request summaries. */
	title: string;

	/** The contributor's explanation of the requested content change. */
	summary: string;
}