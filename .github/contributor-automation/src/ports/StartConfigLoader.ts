import type { StartConfig } from "../domain/StartConfig.js";

/**
 * Defines the validated Stage 6 configuration boundary used by orchestration.
 */
export interface StartConfigLoader
{
	/**
	 * Loads and validates sender, guidance, image, and output settings.
	 *
	 * @param sourcePath The external configuration document path.
	 * @returns A complete repository-owned Stage 6 configuration.
	 */
	Load(sourcePath: string): StartConfig;
}