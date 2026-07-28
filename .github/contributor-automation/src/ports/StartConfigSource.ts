/**
 * Loads untrusted Stage 6 configuration from an external source. Structural
 * validation remains in the application layer so YAML details do not become
 * part of the contributor package contract.
 */
export interface StartConfigSource
{
	/**
	 * Loads one external configuration document without trusting its shape.
	 *
	 * @param sourcePath The configuration path selected by composition.
	 * @returns The parsed external value for application validation.
	 */
	Load(sourcePath: string): unknown;
}