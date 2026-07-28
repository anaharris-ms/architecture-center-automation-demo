/**
 * Defines the boundary for loading untrusted Azure DevOps configuration. The
 * source returns unknown data so validation remains an explicit application
 * responsibility before any destination can be used.
 */
export interface AzureDevOpsConfigSource
{
	/**
	 * Loads one external Azure DevOps configuration document.
	 *
	 * @param sourcePath The source path identifying the configuration document.
	 * @returns The parsed but untrusted configuration value.
	 */
	Load(sourcePath: string): unknown;
}