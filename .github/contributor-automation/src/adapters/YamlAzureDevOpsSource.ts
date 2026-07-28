import fs from "node:fs";
import { parse } from "yaml";
import type { AzureDevOpsConfigSource } from "../ports/AzureDevOpsConfigSource.js";

/**
 * Loads Azure DevOps destination and safety settings from YAML while leaving
 * structural validation to the application boundary.
 */
export class YamlAzureDevOpsSource implements AzureDevOpsConfigSource
{
	/**
	 * Reads and parses one UTF-8 YAML configuration document.
	 *
	 * @param sourcePath The YAML configuration path to load.
	 * @returns The parsed but untrusted YAML value.
	 */
	public Load(sourcePath: string): unknown
	{
		const sourceText: string = fs.readFileSync(sourcePath, "utf8");
		const parsedValue: unknown = parse(sourceText);

		return parsedValue;
	}
}