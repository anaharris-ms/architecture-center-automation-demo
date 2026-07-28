/**
 * Defines deterministic storage for generated private email artifacts. The
 * application depends on this boundary so workflow storage can later replace
 * local files without coupling package behavior to GitHub Actions.
 */
export interface ArtifactWriter
{
	/**
	 * Writes complete text content to the requested artifact path, replacing an
	 * earlier deterministic artifact from a rerun.
	 *
	 * @param filePath The local destination path selected by orchestration.
	 * @param content The complete generated email document.
	 */
	Write(filePath: string, content: string): Promise<void>;
}