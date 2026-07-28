import type { PullRequestObservation } from "../domain/PullRequestObservation.js";
import type { PullRequestResult } from "../domain/PullRequestResult.js";

/**
 * Defines deterministic correlation and persistence for one normalized opened
 * pull-request observation without exposing canonical storage implementation.
 */
export interface PullRequestApplier
{
	/**
	 * Correlates one observation and persists only one unambiguous match.
	 *
	 * @param observation The validated and enriched pull-request facts.
	 * @returns The explicit matched, unmatched, or ambiguous result.
	 */
	Apply(observation: PullRequestObservation): Promise<PullRequestResult>;
}