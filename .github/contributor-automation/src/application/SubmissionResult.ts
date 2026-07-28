import type { FauxSubmissionData } from "../contracts/FauxSubmissionData.js";

/**
 * Describes the result of validating untrusted faux intake data. A successful
 * result contains the typed external contract; a failed result contains every
 * actionable boundary error found in the payload.
 */
export interface SubmissionResult
{
	/** The typed faux intake contract when all boundary checks pass. */
	value: FauxSubmissionData | undefined;

	/** The ordered validation messages describing rejected intake fields. */
	errors: string[];
}