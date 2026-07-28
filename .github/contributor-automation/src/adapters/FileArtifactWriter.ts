import fs from "node:fs/promises";
import path from "node:path";
import type { ArtifactWriter } from "../ports/ArtifactWriter.js";

/**
 * Writes generated email text to a local workflow directory. Parent creation
 * and replacement make apply reruns deterministic; GitHub Actions uploads the
 * resulting file without receiving private message content through stdout.
 */
export class FileArtifactWriter implements ArtifactWriter
{
	/**
	 * Creates the destination directory and writes one complete UTF-8 artifact.
	 * Existing content at the deterministic path is replaced on a rerun.
	 *
	 * @param filePath The local email artifact path.
	 * @param content The complete MIME email content to store.
	 */
	public async Write(filePath: string, content: string): Promise<void>
	{
		const directoryPath: string = path.dirname(filePath);
		await fs.mkdir(directoryPath, { recursive: true });
		await fs.writeFile(filePath, content, "utf8");
	}
}