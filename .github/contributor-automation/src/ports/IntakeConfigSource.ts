/**
 * Defines the boundary for loading untrusted intake-rule configuration. Source
 * adapters return unknown data so validation remains explicit and mandatory.
 */
export interface IntakeConfigSource
{
	/**
	 * Loads one external intake-rule configuration document.
	 *
	 * @param sourcePath The source path identifying the configuration document.
	 * @returns The parsed but untrusted configuration value.
	 */
	Load(sourcePath: string): unknown;
}