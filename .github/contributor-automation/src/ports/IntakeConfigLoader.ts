import type { IntakeConfig } from "../domain/IntakeConfig.js";

/**
 * Defines the application boundary for loading validated intake configuration.
 * Pipeline orchestration does not depend on YAML or another external format.
 */
export interface IntakeConfigLoader
{
	/**
	 * Loads and validates one intake-rule configuration source.
	 *
	 * @param sourcePath The external configuration path to load.
	 * @returns The validated repository-owned intake configuration.
	 */
	Load(sourcePath: string): IntakeConfig;
}