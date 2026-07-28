import type { PullRequestOutcome } from "./PullRequestOutcome.js";

/**
 * Reports whether one normalized pull request resolved to canonical state.
 * Only a matched result includes a submission ID and permits state mutation.
 */
export interface PullRequestResult
{
	/** The deterministic correlation classification. */
	outcome: PullRequestOutcome;

	/** The matched stable submission identity, or undefined without one match. */
	submissionId: string | undefined;
}