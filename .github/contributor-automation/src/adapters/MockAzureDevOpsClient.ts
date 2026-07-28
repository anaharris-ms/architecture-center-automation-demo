import type { StateContent } from "../contracts/StateContent.js";
import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { WorkItemRequest } from "../domain/WorkItemRequest.js";
import type { AzureDevOpsClient } from "../ports/AzureDevOpsClient.js";
import type { OutputWriter } from "../ports/OutputWriter.js";
import type { StateContentClient } from "../ports/StateContentClient.js";

/**
 * Represents one simulated Azure DevOps User Story stored in the temporary
 * mock database. The fields intentionally mirror the business values that a
 * future production adapter will send to Azure DevOps without reproducing REST
 * transport details in application code.
 */
interface MockWorkItem
{
	id: number;
	organization: string;
	project: string;
	workItemType: "User Story";
	submissionId: string;
	parentId: number;
	title: string;
	description: string;
	acceptanceCriteria: string;
	storyPoints: number;
	tags: string;
	createdAt: string;
}

/**
 * Defines the complete temporary work-item database. A schema version makes
 * incompatible future changes explicit, while the next identifier preserves
 * stable positive IDs that exercise normal submission-state correlation.
 */
interface MockDatabase
{
	schemaVersion: number;
	nextWorkItemId: number;
	workItems: MockWorkItem[];
}

/**
 * Simulates the Azure DevOps lookup and creation boundary while real ADO
 * authentication is unavailable. The adapter writes a revision-protected JSON
 * database through the same durable content service used by submission state
 * and emits an explicit log for every ADO operation it replaces.
 */
export class MockAzureDevOpsClient implements AzureDevOpsClient
{
	private readonly contentClient: StateContentClient;
	private readonly outputWriter: OutputWriter;
	private readonly databasePath: string;

	/**
	 * Creates the temporary adapter for one durable mock database document.
	 * Dependency injection keeps GitHub transport and console output outside the
	 * mock's business behavior and makes all simulated operations testable.
	 *
	 * @param contentClient The revision-aware storage used for the mock database.
	 * @param outputWriter The application output boundary receiving mock logs.
	 * @param databasePath The state-branch path for the JSON database document.
	 */
	public constructor(contentClient: StateContentClient, outputWriter: OutputWriter, databasePath: string)
	{
		this.contentClient = contentClient;
		this.outputWriter = outputWriter;
		this.databasePath = databasePath;
	}

	/**
	 * Simulates the production WIQL query that will find exact User Story
	 * matches by submission tag, project, work-item type, and parent Feature.
	 * The mock reads equivalent records from the durable JSON database and
	 * returns matching identifiers in stable numeric order.
	 *
	 * @param submissionId The validated stable submission identity.
	 * @param config The safety-validated Azure DevOps destination.
	 * @returns Matching simulated work-item identifiers in numeric order.
	 */
	public async Find(submissionId: string, config: AzureDevOpsConfig): Promise<number[]>
	{
		this.outputWriter.Write("[MOCK ADO] FIND User Story for " + submissionId + " in " + config.organization + "/" + config.project + ".");
		this.outputWriter.Write("[MOCK ADO] This operation simulates an Azure DevOps WIQL query.");
		const storedContent: StateContent | undefined = await this.contentClient.Read(this.databasePath);
		const database: MockDatabase = this.Parse(storedContent);
		const identifiers: number[] = [];

		for (const workItem of database.workItems)
		{
			if (workItem.submissionId === submissionId
				&& workItem.organization === config.organization
				&& workItem.project === config.project
				&& workItem.parentId === config.parentId)
			{
				identifiers.push(workItem.id);
			}
		}

		identifiers.sort(this.Compare.bind(this));

		if (identifiers.length === 0)
		{
			this.outputWriter.Write("[MOCK ADO] No matching User Story found.");
		}
		else
		{
			this.outputWriter.Write("[MOCK ADO] Found User Story IDs: " + identifiers.join(", ") + ".");
		}

		return identifiers;
	}

	/**
	 * Simulates the production RFC 6902 JSON Patch request that will create a
	 * User Story and link it to the configured parent Feature. The mock stores
	 * the equivalent validated fields, advances its deterministic identifier,
	 * and uses the content revision to reject concurrent database replacement.
	 *
	 * @param request The validated repository-owned User Story values.
	 * @param config The safety-validated Azure DevOps destination.
	 * @returns The created simulated work-item identifier.
	 */
	public async Create(request: WorkItemRequest, config: AzureDevOpsConfig): Promise<number>
	{
		const storedContent: StateContent | undefined = await this.contentClient.Read(this.databasePath);
		const database: MockDatabase = this.Parse(storedContent);
		const workItemId: number = database.nextWorkItemId;
		const workItem: MockWorkItem =
			{
				id: workItemId,
				organization: config.organization,
				project: config.project,
				workItemType: "User Story",
				submissionId: request.submissionId,
				parentId: request.parentId,
				title: request.title,
				description: request.description,
				acceptanceCriteria: request.acceptanceCriteria,
				storyPoints: request.storyPoints,
				tags: request.tags,
				createdAt: new Date().toISOString()
			};
		database.nextWorkItemId = database.nextWorkItemId + 1;
		database.workItems.push(workItem);
		let expectedRevision: string | undefined = undefined;

		if (storedContent !== undefined)
		{
			expectedRevision = storedContent.revision;
		}

		await this.contentClient.Write(
			this.databasePath,
			JSON.stringify(database, undefined, 2) + "\n",
			expectedRevision,
			"Mock ADO: create User Story " + workItemId.toString() + " for " + request.submissionId);
		this.outputWriter.Write("[MOCK ADO] CREATE User Story " + workItemId.toString() + " under Feature " + request.parentId.toString() + ".");
		this.outputWriter.Write("[MOCK ADO] This operation simulates an Azure DevOps JSON Patch create request.");

		return workItemId;
	}

	/**
	 * Parses and validates the complete mock database before any lookup or write.
	 * A missing document produces the known empty database, while malformed or
	 * incompatible persisted content fails visibly instead of losing demo data.
	 *
	 * @param storedContent The persisted document, or undefined before creation.
	 * @returns A validated mutable database value for the current operation.
	 */
	private Parse(storedContent: StateContent | undefined): MockDatabase
	{
		let database: MockDatabase;

		if (storedContent === undefined)
		{
			database =
				{
					schemaVersion: 1,
					nextWorkItemId: 600000,
					workItems: []
				};
		}
		else
		{
			let parsedValue: unknown;

			try
			{
				parsedValue = JSON.parse(storedContent.content) as unknown;
			}
			catch
			{
				throw new Error("Mock ADO database must contain valid JSON.");
			}

			database = this.ReadDatabase(parsedValue);
		}

		return database;
	}

	/**
	 * Validates the database envelope and delegates validation of every stored
	 * work item. Exact schema checks keep the temporary log deterministic and
	 * prevent an edited state document from changing simulated ADO behavior.
	 *
	 * @param value The untrusted JSON value read from durable content storage.
	 * @returns The validated mock database.
	 */
	private ReadDatabase(value: unknown): MockDatabase
	{
		const input: Record<string, unknown> = this.ReadObject(value, "database");
		const schemaVersion: number = this.ReadNumber(input["schemaVersion"], "schemaVersion");

		if (schemaVersion !== 1)
		{
			throw new Error("Mock ADO database schemaVersion must be 1.");
		}

		const nextWorkItemId: number = this.ReadNumber(input["nextWorkItemId"], "nextWorkItemId");
		const workItemsValue: unknown = input["workItems"];

		if (!Array.isArray(workItemsValue))
		{
			throw new Error("Mock ADO database workItems must be an array.");
		}

		const workItems: MockWorkItem[] = [];

		for (const workItemValue of workItemsValue)
		{
			workItems.push(this.ReadWorkItem(workItemValue));
		}

		return {
			schemaVersion: schemaVersion,
			nextWorkItemId: nextWorkItemId,
			workItems: workItems
		};
	}

	/**
	 * Validates every field required to use one stored value as a simulated User
	 * Story. The mock database is treated as untrusted repository content just
	 * like canonical submission state and external API responses.
	 *
	 * @param value The untrusted work-item JSON value.
	 * @returns The validated simulated User Story.
	 */
	private ReadWorkItem(value: unknown): MockWorkItem
	{
		const input: Record<string, unknown> = this.ReadObject(value, "work item");
		const workItemType: string = this.ReadString(input["workItemType"], "workItemType");

		if (workItemType !== "User Story")
		{
			throw new Error("Mock ADO database workItemType must be User Story.");
		}

		return {
			id: this.ReadNumber(input["id"], "id"),
			organization: this.ReadString(input["organization"], "organization"),
			project: this.ReadString(input["project"], "project"),
			workItemType: "User Story",
			submissionId: this.ReadString(input["submissionId"], "submissionId"),
			parentId: this.ReadNumber(input["parentId"], "parentId"),
			title: this.ReadString(input["title"], "title"),
			description: this.ReadString(input["description"], "description"),
			acceptanceCriteria: this.ReadString(input["acceptanceCriteria"], "acceptanceCriteria"),
			storyPoints: this.ReadNumber(input["storyPoints"], "storyPoints"),
			tags: this.ReadString(input["tags"], "tags"),
			createdAt: this.ReadString(input["createdAt"], "createdAt")
		};
	}

	/**
	 * Requires one untrusted JSON value to be a non-array object before named
	 * fields are accessed.
	 *
	 * @param value The untrusted value to inspect.
	 * @param fieldName The value name included in a focused validation error.
	 * @returns The object value used for subsequent field validation.
	 */
	private ReadObject(value: unknown, fieldName: string): Record<string, unknown>
	{
		if (typeof value !== "object" || value === null || Array.isArray(value))
		{
			throw new Error("Mock ADO database " + fieldName + " must be an object.");
		}

		return value as Record<string, unknown>;
	}

	/**
	 * Requires one mock database field to contain a nonempty string.
	 *
	 * @param value The untrusted field value to inspect.
	 * @param fieldName The field name included in a focused validation error.
	 * @returns The validated nonempty string.
	 */
	private ReadString(value: unknown, fieldName: string): string
	{
		if (typeof value !== "string" || value.length === 0)
		{
			throw new Error("Mock ADO database " + fieldName + " must be a nonempty string.");
		}

		return value;
	}

	/**
	 * Requires one mock database field to contain a positive safe integer.
	 *
	 * @param value The untrusted field value to inspect.
	 * @param fieldName The field name included in a focused validation error.
	 * @returns The validated positive safe integer.
	 */
	private ReadNumber(value: unknown, fieldName: string): number
	{
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
		{
			throw new Error("Mock ADO database " + fieldName + " must be a positive safe integer.");
		}

		return value;
	}

	/**
	 * Orders validated work-item identifiers deterministically for duplicate
	 * detection in the existing AzureDevOpsService.
	 *
	 * @param left The first simulated work-item identifier.
	 * @param right The second simulated work-item identifier.
	 * @returns The numeric ordering difference.
	 */
	private Compare(left: number, right: number): number
	{
		return left - right;
	}
}