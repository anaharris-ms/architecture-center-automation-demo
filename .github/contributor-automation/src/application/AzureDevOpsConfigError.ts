/**
 * Reports all validation findings from one Azure DevOps configuration so an
 * operator can repair the complete destination and safety contract together.
 */
export class AzureDevOpsConfigError extends Error
{
	/**
	 * Creates a combined actionable configuration error.
	 *
	 * @param findings The ordered boundary validation findings.
	 */
	public constructor(findings: string[])
	{
		super("Invalid Azure DevOps configuration: " + findings.join(" "));
		this.name = "AzureDevOpsConfigError";
	}
}