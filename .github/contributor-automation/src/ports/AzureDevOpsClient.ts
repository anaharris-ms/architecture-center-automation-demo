import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { WorkItemRequest } from "../domain/WorkItemRequest.js";

/**
 * Defines the minimal Azure DevOps operations required for idempotent User
 * Story creation. Implementations may use memory or REST without changing the
 * application service.
 */
export interface AzureDevOpsClient
{
	/**
	 * Finds User Story identifiers correlated to one exact submission identity.
	 *
	 * @param submissionId The validated stable submission identity.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns Matching work-item identifiers in stable numeric order.
	 */
	Find(submissionId: string, config: AzureDevOpsConfig): Promise<number[]>;

	/**
	 * Creates one validated User Story beneath the configured Feature.
	 *
	 * @param request The repository-owned work-item creation values.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns The created Azure DevOps work-item identifier.
	 */
	Create(request: WorkItemRequest, config: AzureDevOpsConfig): Promise<number>;
}