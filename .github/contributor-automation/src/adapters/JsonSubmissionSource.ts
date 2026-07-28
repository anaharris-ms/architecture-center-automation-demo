import fs from "node:fs";
import type { SubmissionSource } from "../ports/SubmissionSource.js";

/**
 * Loads faux submission intake from a local JSON file. The adapter performs no
 * structural assumptions and returns an unknown value so validation remains an
 * explicit application boundary rather than an implicit parser side effect.
 */
export class JsonSubmissionSource implements SubmissionSource
{
	/**
	 * Reads and parses one UTF-8 JSON fixture. File and JSON syntax errors are
	 * allowed to surface with their original details for local and workflow
	 * diagnostics.
	 *
	 * @param sourcePath The JSON fixture path to load.
	 * @returns The parsed but untrusted JSON value.
	 */
	public Load(sourcePath: string): unknown
	{
		const sourceText: string = fs.readFileSync(sourcePath, "utf8");
		const parsedValue: unknown = JSON.parse(sourceText);

		return parsedValue;
	}
}