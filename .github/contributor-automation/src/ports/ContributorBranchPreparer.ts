import type { ContributorBranch } from "../domain/ContributorBranch.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Defines apply-mode contributor eligibility rechecking and deterministic branch
 * preparation without exposing GitHub transport details to pipeline orchestration.
 */
export interface ContributorBranchPreparer
{
	/**
	 * Rechecks current contributor access and creates or reuses the correlated
	 * contributor branch according to canonical state.
	 *
	 * @param submission The validated contribution whose branch must be prepared.
	 * @returns The correlated branch and whether this invocation created it.
	 */
	Prepare(submission: Submission): Promise<ContributorBranch>;
}