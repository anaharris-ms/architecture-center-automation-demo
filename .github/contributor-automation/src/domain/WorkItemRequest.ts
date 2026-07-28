/**
 * Represents the repository-owned User Story content passed to an Azure DevOps
 * adapter. REST field names and JSON Patch operations remain infrastructure
 * concerns, while this model captures validated business values.
 */
export interface WorkItemRequest
{
	/** The stable submission identity used for duplicate detection. */
	submissionId: string;

	/** The configured Feature that must parent the new User Story. */
	parentId: number;

	/** The User Story title containing the stable submission identity. */
	title: string;

	/** The structured HTML description generated from normalized values. */
	description: string;

	/** The structured HTML acceptance criteria for contribution completion. */
	acceptanceCriteria: string;

	/** The deterministic estimate selected by Stage 4 classification. */
	storyPoints: number;

	/** The controlled semicolon-delimited tags including submission identity. */
	tags: string;
}