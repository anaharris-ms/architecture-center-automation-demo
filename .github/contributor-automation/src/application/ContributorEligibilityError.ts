import type { EligibilityOutcome } from "../domain/EligibilityOutcome.js";

/**
 * Stops branch mutation when the immediately preceding contributor access
 * check does not produce eligibility. The normalized outcome remains available
 * for orchestration without converting technical uncertainty into denial.
 */
export class ContributorEligibilityError extends Error
{
	public readonly outcome: EligibilityOutcome;

	/**
	 * Creates a sanitized failure tied to one submission and approved outcome.
	 *
	 * @param submissionId The stable submission blocked before branch mutation.
	 * @param outcome The normalized current-access outcome returned by verification.
	 */
	public constructor(submissionId: string, outcome: EligibilityOutcome)
	{
		super("Submission " + submissionId + " cannot prepare a branch because contributor eligibility is " + outcome + ".");
		this.name = "ContributorEligibilityError";
		this.outcome = outcome;
	}
}