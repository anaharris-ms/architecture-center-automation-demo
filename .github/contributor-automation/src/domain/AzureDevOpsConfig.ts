/**
 * Represents validated Azure DevOps destination and safety configuration for
 * the hackathon. Authentication remains a runtime secret and is deliberately
 * excluded from this repository-owned model.
 */
export interface AzureDevOpsConfig
{
	/** The Azure DevOps organization containing the demonstration project. */
	organization: string;

	/** The Azure DevOps project receiving contributor User Stories. */
	project: string;

	/** The configured Feature that must parent every generated User Story. */
	parentId: number;

	/** The required stable submission prefix allowed to create work items. */
	allowedPrefix: string;

	/** Controlled tags added to every generated User Story. */
	tags: string[];
}