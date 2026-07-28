import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { WorkItemRequest } from "../domain/WorkItemRequest.js";
import type { WorkItemResult } from "../domain/WorkItemResult.js";
import type { AzureDevOpsClient } from "../ports/AzureDevOpsClient.js";
import type { WorkItemExecutor } from "../ports/WorkItemExecutor.js";
import type { AzureDevOpsSafety } from "./AzureDevOpsSafety.js";
import { DuplicateWorkItemError } from "./DuplicateWorkItemError.js";
import type { WorkItemFactory } from "./WorkItemFactory.js";

/**
 * Executes one validated User Story plan idempotently. Safety checks run before
 * all client operations, duplicate lookup precedes creation, and ambiguous
 * matches fail without changing Azure DevOps.
 */
export class AzureDevOpsService implements WorkItemExecutor
{
	private readonly client: AzureDevOpsClient;
	private readonly safety: AzureDevOpsSafety;
	private readonly requestFactory: WorkItemFactory;

	/**
	 * Creates the service from replaceable client, safety, and mapping boundaries.
	 *
	 * @param client The Azure DevOps lookup and creation adapter.
	 * @param safety The fixed hackathon write-boundary validator.
	 * @param requestFactory The structured User Story request factory.
	 */
	public constructor(client: AzureDevOpsClient, safety: AzureDevOpsSafety, requestFactory: WorkItemFactory)
	{
		this.client = client;
		this.safety = safety;
		this.requestFactory = requestFactory;
	}

	/**
	 * Finds an existing correlated User Story or creates exactly one new item.
	 *
	 * @param actionPlan The validated Stage 4 User Story proposal.
	 * @param config The validated Azure DevOps destination configuration.
	 * @returns The found-or-created work-item result and action key.
	 */
	public async Execute(actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): Promise<WorkItemResult>
	{
		this.safety.Validate(actionPlan, config);
		const matchingIds: number[] = await this.client.Find(actionPlan.submissionId, config);
		let workItemId: number;
		let created: boolean = false;

		if (matchingIds.length > 1)
		{
			throw new DuplicateWorkItemError(actionPlan.submissionId);
		}
		else if (matchingIds.length === 1)
		{
			const existingId: number | undefined = matchingIds.at(0);

			if (existingId === undefined)
			{
				throw new Error("Azure DevOps duplicate lookup returned no identifier.");
			}

			workItemId = existingId;
		}
		else
		{
			const request: WorkItemRequest = this.requestFactory.Create(actionPlan, config);
			workItemId = await this.client.Create(request, config);
			created = true;
		}

		const result: WorkItemResult =
			{
				workItemId: workItemId,
				created: created,
				actionKey: actionPlan.actionKey
			};

		return result;
	}
}