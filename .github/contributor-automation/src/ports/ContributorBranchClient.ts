import type { BranchBase } from "../domain/BranchBase.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";

/**
 * Defines the GitHub branch facts and mutation required by contributor branch
 * preparation. Application code owns correlation and retry decisions while an
 * adapter owns authenticated REST transport and payload validation.
 */
export interface ContributorBranchClient
{
	/**
	 * Resolves the configured contribution base branch and full commit SHA.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @returns The exact configured branch name and commit selected for creation.
	 */
	GetBase(repository: RepositoryTarget): Promise<BranchBase>;

	/**
	 * Reads the current commit for one branch without creating it.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @param branchName The deterministic contributor branch to find.
	 * @returns The current full commit SHA, or undefined when no branch exists.
	 */
	Find(repository: RepositoryTarget, branchName: string): Promise<string | undefined>;

	/**
	 * Creates one fully qualified Git branch reference at an exact commit.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @param branchName The deterministic contributor branch to create.
	 * @param commitSha The persisted full commit SHA used as its initial target.
	 */
	Create(repository: RepositoryTarget, branchName: string, commitSha: string): Promise<void>;
}