import fs from "node:fs";
import { parse } from "yaml";
import type { StartConfigSource } from "../ports/StartConfigSource.js";

/**
 * Reads Stage 6 YAML settings while leaving all trust decisions to the
 * application validation boundary.
 */
export class YamlStartSource implements StartConfigSource
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