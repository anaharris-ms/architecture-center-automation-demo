import type { EligibilityResult } from "../domain/EligibilityResult.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";

/**
 * Defines the external GitHub boundary used to resolve contributor identity and
 * verify effective permission on an operator-approved repository. Adapters
 * normalize API responses and failures into the approved outcomes.
 */
export interface ContributorVerifier
{
	/**
	 * Resolves and verifies one contributor against the requested repository.
	 * Implementations must not infer a business denial from unavailable API data.
	 *
	 * @param githubUsername The mutable username supplied through validated intake.
	 * @param repository The exact repository requiring contributor write access.
	 * @returns The normalized eligibility outcome and immutable ID when eligible.
	 */
	Verify(githubUsername: string, repository: RepositoryTarget): Promise<EligibilityResult>;
}
