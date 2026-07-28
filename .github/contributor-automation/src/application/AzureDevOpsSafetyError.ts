/**
 * Reports a destination or submission that falls outside the fixed hackathon
 * write boundary. Safety failures occur before duplicate queries or mutations.
 */
export class AzureDevOpsSafetyError extends Error
{
	/**
	 * Creates an actionable safety-boundary failure.
	 *
	 * @param finding The specific destination or identity mismatch found.
	 */
	public constructor(finding: string)
	{
		super("Azure DevOps safety check failed: " + finding);
		this.name = "AzureDevOpsSafetyError";
	}
}