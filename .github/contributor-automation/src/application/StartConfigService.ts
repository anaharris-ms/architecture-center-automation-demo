import type { JsonObject } from "../contracts/JsonObject.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { StartConfigLoader } from "../ports/StartConfigLoader.js";
import type { StartConfigSource } from "../ports/StartConfigSource.js";

/**
 * Validates the exact Stage 6 configuration before private email content or
 * repository assets are read. Strict fields prevent silent destination drift.
 */
export class StartConfigService implements StartConfigLoader
{
	private readonly configSource: StartConfigSource;

	/**
	 * Creates the validation boundary around a replaceable external source.
	 *
	 * @param configSource The adapter loading untrusted configuration data.
	 */
	public constructor(configSource: StartConfigSource)
	{
		this.configSource = configSource;
	}

	/**
	 * Loads and validates all required Stage 6 text and URL fields.
	 *
	 * @param sourcePath The external configuration path to load.
	 * @returns A complete validated Stage 6 configuration.
	 */
	public Load(sourcePath: string): StartConfig
	{
		const rawConfig: unknown = this.configSource.Load(sourcePath);
		const fieldNames: string[] = ["senderName", "senderAddress", "subject", "idWebUrl", "accessHelpUrl", "contributionOptionsUrl", "bannerPath", "footerPath", "outputDirectory"];
		let configObject: JsonObject | undefined = undefined;

		if (typeof rawConfig === "object" && rawConfig !== null && !Array.isArray(rawConfig))
		{
			configObject = rawConfig as JsonObject;
		}

		if (configObject === undefined)
		{
			throw new Error("Start-package configuration must be an object.");
		}

		for (const fieldName of fieldNames)
		{
			const fieldValue: unknown = configObject[fieldName];

			if (typeof fieldValue !== "string" || fieldValue.trim().length === 0)
			{
				throw new Error(fieldName + " must be a nonempty string.");
			}
		}

		const actualFields: string[] = Object.keys(configObject);

		for (const actualField of actualFields)
		{
			if (!fieldNames.includes(actualField))
			{
				throw new Error(actualField + " is not supported in start-package configuration.");
			}
		}

		this.CheckUrl(configObject["idWebUrl"] as string, "idWebUrl");
		this.CheckUrl(configObject["accessHelpUrl"] as string, "accessHelpUrl");
		this.CheckUrl(configObject["contributionOptionsUrl"] as string, "contributionOptionsUrl");
		const config: StartConfig =
			{
				senderName: configObject["senderName"] as string,
				senderAddress: configObject["senderAddress"] as string,
				subject: configObject["subject"] as string,
				idWebUrl: configObject["idWebUrl"] as string,
				accessHelpUrl: configObject["accessHelpUrl"] as string,
				contributionOptionsUrl: configObject["contributionOptionsUrl"] as string,
				bannerPath: configObject["bannerPath"] as string,
				footerPath: configObject["footerPath"] as string,
				outputDirectory: configObject["outputDirectory"] as string
			};

		return config;
	}

	/**
	 * Restricts guidance destinations to absolute HTTPS links before insertion
	 * into contributor-facing HTML attributes.
	 *
	 * @param value The configured URL text.
	 * @param fieldName The configuration field used in diagnostics.
	 */
	private CheckUrl(value: string, fieldName: string): void
	{
		const parsedUrl: URL = new URL(value);

		if (parsedUrl.protocol !== "https:")
		{
			throw new Error(fieldName + " must use HTTPS.");
		}
	}
}