/**
 * Reports all validation findings from one external intake-rule document so a
 * configuration owner can correct the complete contract in one edit.
 */
export class IntakeConfigError extends Error
{
	/**
	 * Creates a combined actionable configuration error.
	 *
	 * @param findings The ordered validation findings from the boundary check.
	 */
	public constructor(findings: string[])
	{
		super("Invalid intake configuration: " + findings.join(" "));
		this.name = "IntakeConfigError";
	}
}