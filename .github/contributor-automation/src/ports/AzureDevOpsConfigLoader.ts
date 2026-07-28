import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";

/**
 * Defines the application boundary for obtaining validated Azure DevOps
 * destination and safety settings without depending on YAML representation.
 */
export interface AzureDevOpsConfigLoader
{
	/**
	 * Loads and validates one Azure DevOps configuration source.
	 *
	 * @param sourcePath The external configuration path to load.
	 * @returns The validated repository-owned Azure DevOps configuration.
	 */
	Load(sourcePath: string): AzureDevOpsConfig;
}