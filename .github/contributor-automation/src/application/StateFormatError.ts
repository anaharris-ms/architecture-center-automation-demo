/**
 * Reports a canonical state document that cannot be safely converted into the
 * repository-owned submission state model. The source name is included so a
 * local file or GitHub state document can be repaired without guesswork.
 */
export class StateFormatError extends Error
{
	/**
	 * Creates an error containing the persistence source and validation finding.
	 *
	 * @param sourceName The local path or GitHub content path being decoded.
	 * @param finding The specific contract violation found in the document.
	 */
	public constructor(sourceName: string, finding: string)
	{
		super("Invalid submission state in " + sourceName + ": " + finding);
		this.name = "StateFormatError";
	}
}