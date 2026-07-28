import type { JsonObject } from "../contracts/JsonObject.js";
import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsConfigLoader } from "../ports/AzureDevOpsConfigLoader.js";
import type { AzureDevOpsConfigSource } from "../ports/AzureDevOpsConfigSource.js";
import { AzureDevOpsConfigError } from "./AzureDevOpsConfigError.js";

/**
 * Validates Azure DevOps destination and safety configuration before a REST
 * client can use it. Exact fields and controlled tags prevent configuration
 * drift from silently widening the demonstration write boundary.
 */
export class AzureDevOpsConfigService implements AzureDevOpsConfigLoader
{
	private readonly configSource: AzureDevOpsConfigSource;

	/**
	 * Creates the validation boundary with a replaceable external source.
	 *
	 * @param configSource The adapter that loads untrusted configuration data.
	 */
	public constructor(configSource: AzureDevOpsConfigSource)
	{
		this.configSource = configSource;
	}

	/**
	 * Loads one document and validates all destination and safety fields.
	 *
	 * @param sourcePath The external configuration path to load.
	 * @returns Validated Azure DevOps settings with detached tags.
	 */
	public Load(sourcePath: string): AzureDevOpsConfig
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
			this.CheckText(configObject["organization"], "organization", findings);
			this.CheckText(configObject["project"], "project", findings);
			this.CheckParent(configObject["parentId"], findings);
			this.CheckPrefix(configObject["allowedPrefix"], findings);
			this.CheckTags(configObject["tags"], findings);
		}

		if (findings.length > 0 || configObject === undefined)
		{
			throw new AzureDevOpsConfigError(findings);
		}

		const tags: string[] = configObject["tags"] as string[];
		const config: AzureDevOpsConfig =
			{
				organization: configObject["organization"] as string,
				project: configObject["project"] as string,
				parentId: configObject["parentId"] as number,
				allowedPrefix: configObject["allowedPrefix"] as string,
				tags: [...tags]
			};

		return config;
	}

	/**
	 * Rejects missing and unknown fields in the exact configuration contract.
	 *
	 * @param configObject The parsed configuration object being checked.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckFields(configObject: JsonObject, findings: string[]): void
	{
		const allowedFields: string[] = ["organization", "project", "parentId", "allowedPrefix", "tags"];

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
	 * Validates a required nonempty text setting.
	 *
	 * @param input The unknown external value.
	 * @param fieldName The configuration field used in findings.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckText(input: unknown, fieldName: string, findings: string[]): void
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			findings.push(fieldName + " must be a nonempty string.");
		}
	}

	/**
	 * Validates the configured parent as a positive safe work-item identifier.
	 *
	 * @param input The unknown parent identifier.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckParent(input: unknown, findings: string[]): void
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
		{
			findings.push("parentId must be a positive safe integer.");
		}
	}

	/**
	 * Validates the allowed submission prefix as uppercase letters only.
	 *
	 * @param input The unknown allowed-prefix value.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckPrefix(input: unknown, findings: string[]): void
	{
		const prefixPattern: RegExp = /^[A-Z]+$/;

		if (typeof input !== "string" || !prefixPattern.test(input))
		{
			findings.push("allowedPrefix must contain uppercase letters only.");
		}
	}

	/**
	 * Validates controlled tags as a nonempty collection of unique text values.
	 *
	 * @param input The unknown external tags value.
	 * @param findings The ordered validation findings being accumulated.
	 */
	private CheckTags(input: unknown, findings: string[]): void
	{
		if (!Array.isArray(input) || input.length === 0)
		{
			findings.push("tags must be a nonempty array.");
		}
		else
		{
			const observedTags: string[] = [];

			for (const item of input)
			{
				if (typeof item !== "string" || item.trim().length === 0)
				{
					findings.push("tags must contain nonempty strings.");
				}
				else if (observedTags.includes(item))
				{
					findings.push("tags must contain unique values.");
				}
				else
				{
					observedTags.push(item);
				}
			}
		}
	}
}