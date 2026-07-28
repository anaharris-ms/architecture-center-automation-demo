import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";

/**
 * Provides the two GitHub operations required by explicit stage reopening:
 * verifying maintain/admin repository permission and removing a consumed label
 * so the same command can be intentionally applied again later.
 */
export class GitHubReviewClient
{
	private readonly config: GitHubAccessConfig;

	/**
	 * Creates the client with the short-lived repository workflow token.
	 *
	 * @param config The authenticated GitHub access configuration.
	 */
	public constructor(config: GitHubAccessConfig)
	{
		if (config.token.trim().length === 0)
		{
			throw new Error("GitHub access token must be a nonempty string.");
		}

		this.config = config;
	}

	/**
	 * Reads the actor's effective repository permission and accepts only GitHub's
	 * maintain or admin roles. Contributor write access cannot issue reopen
	 * commands, preserving the internal p&p maintainer boundary.
	 *
	 * @param repository The allowlisted base repository.
	 * @param githubActor The GitHub login that applied the command label.
	 * @returns True only for maintain or admin access.
	 */
	public async IsMaintainer(repository: RepositoryTarget, githubActor: string): Promise<boolean>
	{
		const baseUrl: string = this.GetRepositoryUrl(repository);
		const requestUrl: string = baseUrl + "/collaborators/" + encodeURIComponent(githubActor) + "/permission";
		const response: Response = await fetch(requestUrl, this.CreateRequest("GET"));
		let authorized: boolean = false;

		if (response.status !== 404)
		{
			this.EnsureSuccess(response, "permission check");
			const responseValue: unknown = await response.json();
			const responseObject: JsonObject = this.ReadObject(responseValue);
			const permission: unknown = responseObject["permission"];

			if (permission === "maintain" || permission === "admin")
			{
				authorized = true;
			}
		}

		return authorized;
	}

	/**
	 * Removes one consumed command label. A missing label is treated as an exact
	 * idempotent rerun because canonical event history already owns progression.
	 *
	 * @param repository The allowlisted base repository.
	 * @param pullRequestNumber The positive pull-request number.
	 * @param labelName The exact supported command label to remove.
	 */
	public async RemoveLabel(
		repository: RepositoryTarget,
		pullRequestNumber: number,
		labelName: string): Promise<void>
	{
		const requestUrl: string = this.GetRepositoryUrl(repository)
			+ "/issues/"
			+ pullRequestNumber.toString()
			+ "/labels/"
			+ encodeURIComponent(labelName);
		const response: Response = await fetch(requestUrl, this.CreateRequest("DELETE"));

		if (response.status !== 404)
		{
			this.EnsureSuccess(response, "label removal");
		}
	}

	/**
	 * Builds one versioned authenticated GitHub REST request without placing the
	 * token in URLs or diagnostics.
	 *
	 * @param method The HTTP method required by the operation.
	 * @returns The complete request initialization.
	 */
	private CreateRequest(method: string): RequestInit
	{
		const request: RequestInit =
			{
				method: method,
				headers:
					{
						"Accept": "application/vnd.github+json",
						"Authorization": "Bearer " + this.config.token,
						"X-GitHub-Api-Version": "2022-11-28"
					}
			};

		return request;
	}

	/**
	 * Builds the encoded repository REST URL from trusted routing identity.
	 *
	 * @param repository The repository owner and name.
	 * @returns The encoded GitHub REST repository URL.
	 */
	private GetRepositoryUrl(repository: RepositoryTarget): string
	{
		const owner: string = encodeURIComponent(repository.owner);
		const name: string = encodeURIComponent(repository.name);

		return "https://api.github.com/repos/" + owner + "/" + name;
	}

	/**
	 * Requires a successful HTTP response while keeping external bodies and the
	 * authenticated endpoint out of failure messages.
	 *
	 * @param response The GitHub response to inspect.
	 * @param operation The sanitized operation name.
	 */
	private EnsureSuccess(response: Response, operation: string): void
	{
		if (!response.ok)
		{
			throw new Error("GitHub review " + operation + " failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Requires a non-null, non-array GitHub JSON response object.
	 *
	 * @param input The unknown parsed response value.
	 * @returns The validated response object.
	 */
	private ReadObject(input: unknown): JsonObject
	{
		if (typeof input !== "object" || input === null || Array.isArray(input))
		{
			throw new Error("GitHub review permission response must be an object.");
		}

		return input as JsonObject;
	}
}