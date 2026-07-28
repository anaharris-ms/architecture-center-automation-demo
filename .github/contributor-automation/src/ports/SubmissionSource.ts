/**
 * Defines the external source behavior needed to obtain faux intake data. The
 * unknown return type requires application validation before external JSON can
 * become a normalized submission.
 */
export interface SubmissionSource
{
	/**
	 * Loads one untrusted faux intake value from a source-specific location.
	 *
	 * @param sourcePath The adapter-specific path identifying the intake record.
	 * @returns The untrusted value to validate at the application boundary.
	 */
	Load(sourcePath: string): unknown;
}