import { ApprovalMode } from "../domain/ApprovalMode.js";
import type { IntakeConfig } from "../domain/IntakeConfig.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { IntakeConfigLoader } from "../ports/IntakeConfigLoader.js";
import type { IntakeConfigSource } from "../ports/IntakeConfigSource.js";
import { IntakeConfigError } from "./IntakeConfigError.js";

/**
 * Loads and validates external intake rules before creating pipeline-owned
 * configuration. Exact field validation prevents silent configuration drift
 * from changing estimates or approval behavior.
 */
export class IntakeConfigService implements IntakeConfigLoader
{
	private readonly configSource: IntakeConfigSource;

	/**
	 * Creates the validation boundary with a replaceable configuration source.
	 *
	 * @param configSource The adapter that loads untrusted configuration data.
	 */
	public constructor(configSource: IntakeConfigSource)
	{
		this.configSource = configSource;
	}

	/**
	 * Loads one configuration document and returns validated domain settings.
	 * Missing fields, unknown fields, empty approvers, and unsupported approval
	 * modes are accumulated and reported together.
	 *
	 * @param sourcePath The configuration path to load and validate.
	 * @returns The validated repository-owned intake configuration.
	 */
	public Load(sourcePath: string): IntakeConfig
	{
		const rawConfig: unknown = this.configSource.Load(sourcePath);
		const findings: string[] = [];
		let configObject: JsonObject | undefined = undefined;

		if (typeof rawConfig !== "object" || rawConfig === null || Array.isArray(rawConfig))
		{
			findings.push("The configuration must be an object.");
		}
		else
		{
			configObject = rawConfig as JsonObject;
			this.CheckFields(configObject, findings);
			this.CheckApprover(configObject["defaultApprover"], findings);
			this.CheckMode(configObject["approvalMode"], findings);
			this.CheckRepositories(configObject["allowedRepositories"], findings);
		}

		if (findings.length > 0 || configObject === undefined)
		{
			throw new IntakeConfigError(findings);
		}

		const config: IntakeConfig =
			{
				defaultApprover: configObject["defaultApprover"] as string,
				approvalMode: configObject["approvalMode"] as ApprovalMode,
				allowedRepositories: this.ReadRepositories(configObject["allowedRepositories"])
			};

		return config;
	}

	/**
	 * Rejects missing and unknown root fields in the exact demonstration contract.
	 *
	 * @param configObject The parsed configuration object being checked.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckFields(configObject: JsonObject, findings: string[]): void
	{
		const allowedFields: string[] = ["defaultApprover", "approvalMode", "allowedRepositories"];

		for (const allowedField of allowedFields)
		{
			if (!(allowedField in configObject))
			{
				findings.push(allowedField + " is required.");
			}
		}

		const actualFields: string[] = Object.keys(configObject);

		for (const actualField of actualFields)
		{
			if (!allowedFields.includes(actualField))
			{
				findings.push(actualField + " is not supported.");
			}
		}
	}

	/**
	 * Validates the configured human approver as nonempty text.
	 *
	 * @param input The unknown approver value from external configuration.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckApprover(input: unknown, findings: string[]): void
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			findings.push("defaultApprover must be a nonempty string.");
		}
	}

	/**
	 * Validates approval behavior against the modes supported by intake rules.
	 *
	 * @param input The unknown approval-mode value from configuration.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckMode(input: unknown, findings: string[]): void
	{
		if (input !== ApprovalMode.Preapproved && input !== ApprovalMode.ApprovalRequired)
		{
			findings.push("approvalMode must be preapproved or approval-required.");
		}
	}

	/**
	 * Validates a nonempty repository allowlist with exact owner and name fields.
	 * Duplicate GitHub identities are rejected without case sensitivity because
	 * GitHub owner and repository names are case-insensitive.
	 *
	 * @param input The unknown repository allowlist from configuration.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckRepositories(input: unknown, findings: string[]): void
	{
		if (!Array.isArray(input) || input.length === 0)
		{
			findings.push("allowedRepositories must be a nonempty array.");
		}
		else
		{
			const identities: string[] = [];

			for (let index: number = 0; index < input.length; index += 1)
			{
				const item: unknown = input[index];

				if (typeof item !== "object" || item === null || Array.isArray(item))
				{
					findings.push("allowedRepositories item " + index.toString() + " must be an object.");
				}
				else
				{
					const repositoryObject: JsonObject = item as JsonObject;
					this.CheckRepository(repositoryObject, index, identities, findings);
				}
			}
		}
	}

	/**
	 * Validates one allowlisted repository and records its normalized identity
	 * after exact-field and nonempty-string checks succeed.
	 *
	 * @param repositoryObject The parsed repository object being checked.
	 * @param index The zero-based location used in actionable findings.
	 * @param identities The normalized identities already accepted.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckRepository(repositoryObject: JsonObject, index: number, identities: string[], findings: string[]): void
	{
		const fieldPath: string = "allowedRepositories item " + index.toString();
		const actualFields: string[] = Object.keys(repositoryObject);

		for (const actualField of actualFields)
		{
			if (actualField !== "owner" && actualField !== "name")
			{
				findings.push(fieldPath + "." + actualField + " is not supported.");
			}
		}

		const owner: unknown = repositoryObject["owner"];
		const name: unknown = repositoryObject["name"];

		if (typeof owner !== "string" || owner.trim().length === 0)
		{
			findings.push(fieldPath + ".owner must be a nonempty string.");
		}

		if (typeof name !== "string" || name.trim().length === 0)
		{
			findings.push(fieldPath + ".name must be a nonempty string.");
		}

		if (typeof owner === "string" && owner.trim().length > 0 && typeof name === "string" && name.trim().length > 0)
		{
			const identity: string = owner.toLowerCase() + "/" + name.toLowerCase();

			if (identities.includes(identity))
			{
				findings.push("allowedRepositories must contain unique repositories.");
			}
			else
			{
				identities.push(identity);
			}
		}
	}

	/**
	 * Copies the already validated repository allowlist into domain records so
	 * YAML objects cannot be mutated through the returned configuration.
	 *
	 * @param input The validated external repository array.
	 * @returns Detached repository targets in configured order.
	 */
	private ReadRepositories(input: unknown): RepositoryTarget[]
	{
		const repositories: RepositoryTarget[] = [];
		const inputRepositories: unknown[] = input as unknown[];

		for (const item of inputRepositories)
		{
			const repositoryObject: JsonObject = item as JsonObject;
			const repository: RepositoryTarget =
				{
					owner: repositoryObject["owner"] as string,
					name: repositoryObject["name"] as string
				};
			repositories.push(repository);
		}

		return repositories;
	}
}
