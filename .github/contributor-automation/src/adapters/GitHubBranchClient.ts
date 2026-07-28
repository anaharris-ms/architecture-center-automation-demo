import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { BranchBase } from "../domain/BranchBase.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { ContributorBranchClient } from "../ports/ContributorBranchClient.js";

/**
 * Adapts GitHub repository and Git References REST endpoints to validated branch
 * facts and creation. The fork-local workflow token remains confined to
 * request headers and all external payloads are validated before use.
 */
export class GitHubBranchClient implements ContributorBranchClient
{
	private readonly config: GitHubAccessConfig;
	private readonly baseBranch: string;

	/**
	 * Creates the branch adapter with a token authorized for the target fork and
	 * an explicit trusted base branch. Requiring the branch at composition time
	 * prevents repository default-branch changes from redirecting demo branches.
	 *
	 * @param config The fork-local GitHub access-token configuration.
	 * @param baseBranch The operator-selected branch used for contributor work.
	 */
	public constructor(config: GitHubAccessConfig, baseBranch: string)
	{
		if (config.token.trim().length === 0)
		{
			throw new Error("GitHub access token must be a nonempty string.");
		}
		else if (baseBranch.trim().length === 0)
		{
			throw new Error("GitHub contribution base branch must be a nonempty string.");
		}

		this.config = config;
		this.baseBranch = baseBranch;
	}

	/**
	 * Resolves the configured trusted base branch to its exact Git ref. The
	 * successful payload is validated before the base reaches application code,
	 * preventing malformed GitHub data from being persisted as correlation.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @returns The configured base branch name and full target commit SHA.
	 */
	public async GetBase(repository: RepositoryTarget): Promise<BranchBase>
	{
		const commitSha: string | undefined = await this.Find(repository, this.baseBranch);

		if (commitSha === undefined)
		{
			throw new Error("GitHub contribution base branch reference was not found.");
		}

		const branchBase: BranchBase =
			{
				branchName: this.baseBranch,
				commitSha: commitSha
			};

		return branchBase;
	}

	/**
	 * Reads one Git reference and returns undefined only for an explicit 404.
	 * Authentication, rate-limit, and malformed-response failures remain errors.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @param branchName The complete branch name to read.
	 * @returns The full current commit SHA, or undefined when absent.
	 */
	public async Find(repository: RepositoryTarget, branchName: string): Promise<string | undefined>
	{
		const response: Response = await fetch(this.GetReferenceUrl(repository, branchName), this.GetRequest("GET"));
		let commitSha: string | undefined = undefined;

		if (response.status !== 404)
		{
			this.EnsureSuccess(response, "reference");
			const responseObject: JsonObject = await this.ReadResponse(response, "GitHub reference response");
			const objectValue: JsonObject = this.ReadObject(responseObject["object"], "object");
			commitSha = this.ReadSha(objectValue["sha"]);
		}

		return commitSha;
	}

	/**
	 * Creates one branch reference at the exact commit previously persisted by
	 * application orchestration. GitHub conflicts remain failures for the caller
	 * to reconcile through a fresh read rather than assuming correlation.
	 *
	 * @param repository The operator-allowlisted contribution repository.
	 * @param branchName The deterministic contributor branch name.
	 * @param commitSha The persisted full commit SHA used as the initial target.
	 */
	public async Create(repository: RepositoryTarget, branchName: string, commitSha: string): Promise<void>
	{
		const requestBody: JsonObject =
			{
				ref: "refs/heads/" + branchName,
				sha: this.ReadSha(commitSha)
			};
		const request: RequestInit = this.GetRequest("POST");
		request.body = JSON.stringify(requestBody);
		const requestUrl: string = this.GetRepositoryUrl(repository) + "/git/refs";
		const response: Response = await fetch(requestUrl, request);
		this.EnsureSuccess(response, "reference creation");
	}

	/**
	 * Builds one authenticated versioned GitHub REST request without exposing the
	 * repository token outside request headers.
	 *
	 * @param method The HTTP method required by the endpoint.
	 * @returns A complete GitHub REST request initialization.
	 */
	private GetRequest(method: string): RequestInit
	{
		const request: RequestInit =
			{
				method: method,
				headers:
					{
						"Accept": "application/vnd.github+json",
						"Authorization": "Bearer " + this.config.token,
						"Content-Type": "application/json",
						"X-GitHub-Api-Version": "2022-11-28"
					}
			};

		return request;
	}

	/**
	 * Builds the encoded repository REST URL shared by repository and ref calls.
	 *
	 * @param repository The repository owner and name to encode.
	 * @returns The complete GitHub repository endpoint URL.
	 */
	private GetRepositoryUrl(repository: RepositoryTarget): string
	{
		const owner: string = encodeURIComponent(repository.owner);
		const name: string = encodeURIComponent(repository.name);
		const requestUrl: string = "https://api.github.com/repos/" + owner + "/" + name;

		return requestUrl;
	}

	/**
	 * Builds a Git reference URL while preserving branch path structure and
	 * encoding every segment independently.
	 *
	 * @param repository The repository containing the branch.
	 * @param branchName The complete branch name whose segments will be encoded.
	 * @returns The complete Git References endpoint URL.
	 */
	private GetReferenceUrl(repository: RepositoryTarget, branchName: string): string
	{
		const branchParts: string[] = branchName.split("/");
		const encodedParts: string[] = [];

		for (const branchPart of branchParts)
		{
			encodedParts.push(encodeURIComponent(branchPart));
		}

		const requestUrl: string = this.GetRepositoryUrl(repository) + "/git/ref/heads/" + encodedParts.join("/");

		return requestUrl;
	}

	/**
	 * Rejects unsuccessful responses with status-only diagnostics that cannot
	 * expose response bodies or runtime credentials.
	 *
	 * @param response The GitHub response whose status is being checked.
	 * @param operation The sanitized operation name used in the error message.
	 */
	private EnsureSuccess(response: Response, operation: string): void
	{
		if (!response.ok)
		{
			throw new Error("GitHub " + operation + " request failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Parses a successful response and requires a non-null top-level JSON object.
	 *
	 * @param response The successful GitHub response to parse.
	 * @param fieldPath The response name used only in sanitized errors.
	 * @returns The validated top-level response object.
	 */
	private async ReadResponse(response: Response, fieldPath: string): Promise<JsonObject>
	{
		const responseValue: unknown = await response.json();
		const responseObject: JsonObject = this.ReadObject(responseValue, fieldPath);

		return responseObject;
	}

	/**
	 * Requires a non-null, non-array object from an untrusted GitHub payload.
	 *
	 * @param input The unknown response field value.
	 * @param fieldPath The response field used in sanitized errors.
	 * @returns The validated object value.
	 */
	private ReadObject(input: unknown, fieldPath: string): JsonObject
	{
		if (typeof input !== "object" || input === null || Array.isArray(input))
		{
			throw new Error(fieldPath + " must be an object.");
		}

		return input as JsonObject;
	}

	/**
	 * Requires a nonempty string from an untrusted GitHub response field.
	 *
	 * @param input The unknown response field value.
	 * @param fieldPath The field name used in sanitized errors.
	 * @returns The validated nonempty string.
	 */
	private ReadString(input: unknown, fieldPath: string): string
	{
		if (typeof input !== "string" || input.length === 0)
		{
			throw new Error("GitHub response " + fieldPath + " must be a nonempty string.");
		}

		return input;
	}

	/**
	 * Requires and normalizes one full Git commit SHA before it crosses the REST
	 * adapter boundary or is sent in a branch creation request.
	 *
	 * @param input The unknown SHA value supplied by GitHub or application state.
	 * @returns The validated lowercase 40-character commit SHA.
	 */
	private ReadSha(input: unknown): string
	{
		const commitSha: string = this.ReadString(input, "object.sha");
		const shaPattern: RegExp = /^[0-9a-fA-F]{40}$/;

		if (!shaPattern.test(commitSha))
		{
			throw new Error("GitHub response object.sha must be a full commit SHA.");
		}

		return commitSha.toLowerCase();
	}
}