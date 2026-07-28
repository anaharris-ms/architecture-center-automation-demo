import type { EligibilityOutcome } from "./EligibilityOutcome.js";

/**
 * Represents the normalized result of resolving a GitHub account and checking
 * effective permission on an operator-approved repository.
 * The immutable numeric identity is required by application behavior only when
 * the outcome is eligible and remains absent for every blocked outcome.
 */
export interface EligibilityResult
{
	/** The approved normalized eligibility outcome. */
	outcome: EligibilityOutcome;

	/** The immutable GitHub user ID when all eligibility checks succeed. */
	githubUserId: number | undefined;
}
