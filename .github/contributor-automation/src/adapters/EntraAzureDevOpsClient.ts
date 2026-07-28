import type { JsonObject } from "../contracts/JsonObject.js";
import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { WorkItemRequest } from "../domain/WorkItemRequest.js";
import type { AzureDevOpsClient } from "../ports/AzureDevOpsClient.js";

/**
 * Calls Azure DevOps work-item REST APIs with a short-lived Microsoft Entra
 * bearer token supplied by the trusted GitHub Actions workflow. The adapter
 * validates every external response and keeps authentication, HTTP payloads,
 * and Azure DevOps field names outside application and domain behavior.
 */
export class EntraAzureDevOpsClient implements AzureDevOpsClient
{
	private readonly accessToken: string;

	/**
	 * Creates the REST adapter with the one-hour token acquired through GitHub
	 * OIDC and Azure Login. Rejecting an empty value during composition prevents
	 * unauthenticated requests and keeps the token out of later diagnostics.
	 *
	 * @param accessToken The short-lived Azure DevOps Microsoft Entra token.
	 */
	public constructor(accessToken: string)
	{
		if (accessToken.trim().length === 0)
		{
			throw new Error("Azure DevOps access token must be a nonempty string.");
		}

		this.accessToken = accessToken;
	}

	/**
	 * Finds exact User Story matches for one submission. WIQL narrows candidates
	 * by project, type, and tag text, then a batch read verifies the complete tag,
	 * work-item type, and configured parent before returning stable identifiers.
	 *
	 * @param submissionId The validated stable submission identity.
	 * @param config The safety-validated Azure DevOps destination.
	 * @returns Exact matching work-item identifiers in numeric order.
	 */
	public async Find(submissionId: string, config: AzureDevOpsConfig): Promise<number[]>
	{
		const candidateIds: number[] = await this.QueryCandidates(submissionId, config);
		let matchingIds: number[] = [];

		if (candidateIds.length > 0)
		{
			matchingIds = await this.FilterCandidates(candidateIds, submissionId, config);
		}

		matchingIds.sort(this.Compare.bind(this));

		return matchingIds;
	}

	/**
	 * Creates one User Story using standard process fields and a hierarchy link
	 * to the configured parent Feature. Repository-owned request values are sent
	 * as RFC 6902 JSON Patch without interpreting contributor content in transport.
	 *
	 * @param request The validated repository-owned User Story values.
	 * @param config The safety-validated Azure DevOps destination.
	 * @returns The positive identifier returned for the created work item.
	 */
	public async Create(request: WorkItemRequest, config: AzureDevOpsConfig): Promise<number>
	{
		const requestUrl: string = this.GetBaseUrl(config) + "/workitems/$User%20Story?api-version=7.1";
		const parentUrl: string = "https://dev.azure.com/" + encodeURIComponent(config.organization)
			+ "/_apis/wit/workItems/" + request.parentId.toString();
		const patch: JsonObject[] =
			[
				this.CreatePatch("/fields/System.Title", request.title),
				this.CreatePatch("/fields/System.Description", request.description),
				this.CreatePatch("/fields/Microsoft.VSTS.Common.AcceptanceCriteria", request.acceptanceCriteria),
				this.CreatePatch("/fields/Microsoft.VSTS.Scheduling.StoryPoints", request.storyPoints),
				this.CreatePatch("/fields/System.Tags", request.tags),
				{
					op: "add",
					path: "/relations/-",
					value:
				{
					rel: "System.LinkTypes.Hierarchy-Reverse",
					url: parentUrl
				}
				}
			];
		const responseObject: JsonObject = await this.Send(
			requestUrl,
			"PATCH",
			patch,
			"application/json-patch+json",
			"create");
		const workItemId: number = this.ReadId(responseObject["id"], "create response id");

		return workItemId;
	}

	/**
	 * Queries Azure DevOps for bounded candidate identifiers. Candidate matching
	 * remains deliberately broader than the final check because WIQL tag contains
	 * semantics can also return values such as `HACK-00010` for `HACK-0001`.
	 *
	 * @param submissionId The stable identity used to narrow the WIQL query.
	 * @param config The validated project destination.
	 * @returns Positive unique candidate identifiers in response order.
	 */
	private async QueryCandidates(submissionId: string, config: AzureDevOpsConfig): Promise<number[]>
	{
		const requestUrl: string = this.GetBaseUrl(config) + "/wiql?api-version=7.1";
		const safeSubmissionId: string = submissionId.replaceAll("'", "''");
		const query: string = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project"
			+ " AND [System.WorkItemType] = 'User Story'"
			+ " AND [System.Tags] CONTAINS '" + safeSubmissionId + "'";
		const requestBody: JsonObject =
			{
				query: query
			};
		const responseObject: JsonObject = await this.Send(requestUrl, "POST", requestBody, "application/json", "WIQL");
		const workItemsValue: unknown = responseObject["workItems"];

		if (!Array.isArray(workItemsValue))
		{
			throw new Error("Azure DevOps WIQL response workItems must be an array.");
		}

		if (workItemsValue.length > 200)
		{
			throw new Error("Azure DevOps WIQL response exceeds the 200-item verification limit.");
		}

		const candidateIds: number[] = [];

		for (const workItemValue of workItemsValue)
		{
			const workItem: JsonObject = this.ReadObject(workItemValue, "WIQL work item");
			const workItemId: number = this.ReadId(workItem["id"], "WIQL work item id");

			if (candidateIds.includes(workItemId))
			{
				throw new Error("Azure DevOps WIQL response contains duplicate work-item identifiers.");
			}

			candidateIds.push(workItemId);
		}

		return candidateIds;
	}

	/**
	 * Batch-reads candidate fields and retains only complete correlation matches.
	 * This second verification protects idempotency from partial tag matches,
	 * moved work items, and unexpected work-item types returned by external data.
	 *
	 * @param candidateIds The bounded identifiers returned by WIQL.
	 * @param submissionId The complete tag value required for correlation.
	 * @param config The configured parent Feature and project destination.
	 * @returns Exact candidate identifiers in external response order.
	 */
	private async FilterCandidates(
		candidateIds: number[],
		submissionId: string,
		config: AzureDevOpsConfig): Promise<number[]>
	{
		const requestUrl: string = this.GetBaseUrl(config) + "/workitemsbatch?api-version=7.1";
		const requestBody: JsonObject =
			{
				ids: candidateIds,
				fields:
			[
				"System.Id",
				"System.WorkItemType",
				"System.Tags",
				"System.Parent"
			],
				errorPolicy: "Fail"
			};
		const responseObject: JsonObject = await this.Send(requestUrl, "POST", requestBody, "application/json", "batch read");
		const workItemsValue: unknown = responseObject["value"];

		if (!Array.isArray(workItemsValue))
		{
			throw new Error("Azure DevOps batch response value must be an array.");
		}

		const matchingIds: number[] = [];

		for (const workItemValue of workItemsValue)
		{
			const workItem: JsonObject = this.ReadObject(workItemValue, "batch work item");
			const workItemId: number = this.ReadId(workItem["id"], "batch work item id");
			const fields: JsonObject = this.ReadObject(workItem["fields"], "batch work item fields");
			const workItemType: string = this.ReadString(fields["System.WorkItemType"], "System.WorkItemType");
			const tags: string = this.ReadString(fields["System.Tags"], "System.Tags");
			const parentId: number = this.ReadId(fields["System.Parent"], "System.Parent");
			const exactTag: boolean = this.HasTag(tags, submissionId);

			if (workItemType === "User Story" && parentId === config.parentId && exactTag)
			{
				matchingIds.push(workItemId);
			}
		}

		return matchingIds;
	}

	/**
	 * Sends one authenticated REST request and parses its top-level JSON object.
	 * Network failures, response bodies, and token values are normalized into
	 * operation-specific errors that are safe for workflow logs.
	 *
	 * @param requestUrl The complete encoded Azure DevOps endpoint.
	 * @param method The required HTTP method.
	 * @param requestBody The structured request body.
	 * @param contentType The media type required by the endpoint.
	 * @param operation The non-secret operation name used in diagnostics.
	 * @returns The validated top-level response object.
	 */
	private async Send(
		requestUrl: string,
		method: string,
		requestBody: JsonObject | JsonObject[],
		contentType: string,
		operation: string): Promise<JsonObject>
	{
		const request: RequestInit =
			{
				method: method,
				headers:
			{
				"Accept": "application/json",
				"Authorization": "Bearer " + this.accessToken,
				"Content-Type": contentType
			},
				body: JSON.stringify(requestBody)
			};
		let response: Response;

		try
		{
			response = await fetch(requestUrl, request);
		}
		catch
		{
			throw new Error("Azure DevOps " + operation + " request failed.");
		}

		if (!response.ok)
		{
			throw new Error("Azure DevOps " + operation + " request failed with HTTP " + response.status.toString() + ".");
		}

		const responseValue: unknown = await response.json();
		const responseObject: JsonObject = this.ReadObject(responseValue, operation + " response");

		return responseObject;
	}

	/**
	 * Builds the encoded work-item API base URL for one validated destination.
	 * Encoding keeps configuration values in path segments and prevents them from
	 * changing endpoint structure.
	 *
	 * @param config The validated organization and project destination.
	 * @returns The complete work-item REST API base URL.
	 */
	private GetBaseUrl(config: AzureDevOpsConfig): string
	{
		const organization: string = encodeURIComponent(config.organization);
		const project: string = encodeURIComponent(config.project);
		const requestUrl: string = "https://dev.azure.com/" + organization + "/" + project + "/_apis/wit";

		return requestUrl;
	}

	/**
	 * Creates one standard add operation for a work-item JSON Patch field.
	 *
	 * @param path The Azure DevOps field path.
	 * @param value The validated field value.
	 * @returns One RFC 6902 add operation.
	 */
	private CreatePatch(path: string, value: string | number): JsonObject
	{
		const operation: JsonObject =
			{
				op: "add",
				path: path,
				value: value
			};

		return operation;
	}

	/**
	 * Determines whether a semicolon-delimited Azure DevOps tag field contains
	 * one complete case-sensitive submission identity.
	 *
	 * @param tags The untrusted Azure DevOps tag field.
	 * @param requiredTag The exact validated submission tag.
	 * @returns True only when one trimmed complete tag equals the identity.
	 */
	private HasTag(tags: string, requiredTag: string): boolean
	{
		const tagValues: string[] = tags.split(";");
		let found: boolean = false;

		for (const tagValue of tagValues)
		{
			if (tagValue.trim() === requiredTag)
			{
				found = true;
			}
		}

		return found;
	}

	/**
	 * Requires one untrusted response value to be a non-array object.
	 *
	 * @param value The external JSON value to inspect.
	 * @param fieldPath The response path used in a sanitized error.
	 * @returns The validated JSON object.
	 */
	private ReadObject(value: unknown, fieldPath: string): JsonObject
	{
		if (typeof value !== "object" || value === null || Array.isArray(value))
		{
			throw new Error("Azure DevOps " + fieldPath + " must be an object.");
		}

		return value as JsonObject;
	}

	/**
	 * Requires one external identity field to be a positive safe integer.
	 *
	 * @param value The external response value to inspect.
	 * @param fieldPath The response field used in a sanitized error.
	 * @returns The validated positive identifier.
	 */
	private ReadId(value: unknown, fieldPath: string): number
	{
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
		{
			throw new Error("Azure DevOps " + fieldPath + " must be a positive safe integer.");
		}

		return value;
	}

	/**
	 * Requires one external response field to be a nonempty string.
	 *
	 * @param value The external response value to inspect.
	 * @param fieldPath The response field used in a sanitized error.
	 * @returns The validated nonempty string.
	 */
	private ReadString(value: unknown, fieldPath: string): string
	{
		if (typeof value !== "string" || value.length === 0)
		{
			throw new Error("Azure DevOps " + fieldPath + " must be a nonempty string.");
		}

		return value;
	}

	/**
	 * Compares two positive work-item identifiers for deterministic ordering.
	 *
	 * @param first The first work-item identifier.
	 * @param second The second work-item identifier.
	 * @returns A negative, zero, or positive numeric comparison result.
	 */
	private Compare(first: number, second: number): number
	{
		return first - second;
	}
}