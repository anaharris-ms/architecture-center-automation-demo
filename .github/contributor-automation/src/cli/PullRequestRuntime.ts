import type { GitHubStateConfig } from "../contracts/GitHubStateConfig.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { OutputWriter } from "../ports/OutputWriter.js";

/**
 * Centralizes environment validation and sanitized composition failures shared
 * by the event and trusted receiver entry points. Keeping these rules together
 * prevents either command from falling back across event-read and state-write
 * credentials or selecting an implicit repository from workflow context.
 */
export class PullRequestRuntime
{
	private readonly outputWriter: OutputWriter;

	/**
	 * Creates runtime validation with the operator-visible output destination used
	 * for failures that occur before application orchestration can begin.
	 *
	 * @param outputWriter The destination for sanitized composition failures.
	 */
	public constructor(outputWriter: OutputWriter)
	{
		this.outputWriter = outputWriter;
	}

	/**
	 * Reads one required nonempty runtime value without exposing its contents in a
	 * failure message, preserving event-read and state-write credential secrecy.
	 *
	 * @param variableName The required environment variable name.
	 * @returns The configured nonempty runtime value.
	 */
	public ReadRequired(variableName: string): string
	{
		const value: string | undefined = process.env[variableName];

		if (value === undefined || value.trim().length === 0)
		{
			throw new Error(variableName + " must be configured for pull-request processing.");
		}

		return value;
	}

	/**
	 * Builds the cross-repository canonical-state target from explicit environment
	 * values so no event repository can become the state repository implicitly.
	 *
	 * @returns The validated automation repository state configuration.
	 */
	public GetStateConfig(): GitHubStateConfig
	{
		const repositoryValue: string = this.ReadRequired("GITHUB_STATE_REPOSITORY");
		const repositoryParts: string[] = repositoryValue.split("/");
		const owner: string | undefined = repositoryParts[0];
		const repository: string | undefined = repositoryParts[1];

		if (repositoryParts.length !== 2
			|| owner === undefined
			|| owner.length === 0
			|| repository === undefined
			|| repository.length === 0)
		{
			throw new Error("GITHUB_STATE_REPOSITORY must use owner/repository format.");
		}

		let branch: string = "submission-state";
		const configuredBranch: string | undefined = process.env["GITHUB_STATE_BRANCH"];

		if (configuredBranch !== undefined && configuredBranch.trim().length > 0)
		{
			branch = configuredBranch;
		}

		const config: GitHubStateConfig =
			{
				owner: owner,
				repository: repository,
				branch: branch,
				token: this.ReadRequired("GITHUB_STATE_TOKEN")
			};

		return config;
	}

	/**
	 * Requires the receiver-selected repository to equal the one explicit runtime
	 * allowlist entry before a repository token is used to retrieve PR facts.
	 *
	 * @param repository The parsed repository supplied by workflow dispatch.
	 */
	public RequireRepository(repository: RepositoryTarget): void
	{
		const allowedRepository: string = this.ReadRequired("GITHUB_ALLOWED_PR_REPOSITORY");
		const requestedRepository: string = repository.owner + "/" + repository.name;

		if (requestedRepository !== allowedRepository)
		{
			throw new Error("Pull-request repository is not allowlisted for receiver processing.");
		}
	}

	/**
	 * Reports one sanitized composition failure while retaining process exit code
	 * one and excluding credential values or untrusted GitHub response bodies.
	 *
	 * @param error The unknown runtime composition failure.
	 */
	public WriteFailure(error: unknown): void
	{
		let errorMessage: string = "Pull-request processing failed with an unknown error.";

		if (error instanceof Error)
		{
			errorMessage = "Pull-request processing failed: " + error.message;
		}

		this.outputWriter.Write(errorMessage);
	}
}