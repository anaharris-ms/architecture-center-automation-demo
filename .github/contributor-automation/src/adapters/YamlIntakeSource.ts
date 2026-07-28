import fs from "node:fs";
import { parse } from "yaml";
import type { IntakeConfigSource } from "../ports/IntakeConfigSource.js";

/**
 * Loads demonstration intake rules from a YAML document. Parsing and file
 * access remain adapter concerns, while structural and business validation are
 * performed by the application boundary.
 */
export class YamlIntakeSource implements IntakeConfigSource
{
	/**
	 * Reads and parses one UTF-8 YAML document without assuming its structure.
	 * File and YAML syntax failures retain their original diagnostic details.
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