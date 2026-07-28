import type { ApprovalMode } from "./ApprovalMode.js";
import type { RepositoryTarget } from "./RepositoryTarget.js";

/**
 * Represents validated intake behavior used when creating an Azure DevOps
 * action plan. Configuration values are supplied externally so approver names
 * and approval policy do not become embedded business logic.
 */
export interface IntakeConfig
{
	/** The configured approver recorded in the planned User Story. */
	defaultApprover: string;

	/** The validated approval behavior applied to the submission. */
	approvalMode: ApprovalMode;

	/** The trusted GitHub repositories that may receive contributor work. */
	allowedRepositories: RepositoryTarget[];
}
