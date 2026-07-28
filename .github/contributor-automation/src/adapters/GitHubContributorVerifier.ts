import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import { EligibilityOutcome } from "../domain/EligibilityOutcome.js";
import type { EligibilityResult } from "../domain/EligibilityResult.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { ContributorVerifier } from "../ports/ContributorVerifier.js";

/**
 * Resolves immutable GitHub identity and verifies effective repository access
 * through authenticated REST requests. A repository visibility preflight makes
 * permission denial distinguishable from missing App access to a private fork.
 */
export class GitHubContributorVerifier implements ContributorVerifier
{
	private readonly config: GitHubAccessConfig;

	/**
	 * Creates the verifier with a runtime fork-local repository token.
	 *
	 * @param config The secret authentication configuration for API requests.
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
	 * Resolves the submitted username, confirms the App can see the configured
	 * repository, and accepts effective write or admin permission. GitHub maps
	 * maintain to legacy write permission, so write includes maintain access.
	 * Every technical or malformed-response failure is normalized to
	 * verification-failed instead of becoming a business access denial.
	 *
	 * @param githubUsername The mutable username supplied through validated intake.
	 * @param repository The operator-allowlisted private repository target.
	 * @returns The normalized eligibility outcome and immutable ID when eligible.
	 */
	public async Verify(githubUsername: string, repository: RepositoryTarget): Promise<EligibilityResult>
	{
		let result: EligibilityResult;

		try
		{
			const githubUserId: number | undefined = await this.ResolveUser(githubUsername);

			if (githubUserId === undefined)
			{
				result = this.CreateResult(EligibilityOutcome.UnknownUser, undefined);
			}
			else
			{
				await this.CheckRepository(repository);
				result = await this.CheckPermission(githubUsername, repository, githubUserId);
			}
		}
		catch
		{
			result = this.CreateResult(EligibilityOutcome.VerificationFailed, undefined);
		}

		return result;
	}

	/**
	 * Resolves a mutable login to GitHub's positive immutable numeric identity.
	 * A user endpoint 404 is the only response interpreted as an unknown account.
	 *
	 * @param githubUsername The validated GitHub login to resolve.
	 * @returns The immutable user ID, or undefined when GitHub returns 404.
	 */
	private async ResolveUser(githubUsername: string): Promise<number | undefined>
	{
		const requestUrl: string = "https://api.github.com/users/" + encodeURIComponent(githubUsername);
		const response: Response = await fetch(requestUrl, this.GetRequest());
		let githubUserId: number | undefined = undefined;

		if (response.status !== 404)
		{
			this.EnsureSuccess(response);
			const responseObject: JsonObject = await this.ReadResponse(response, "GitHub user response");
			githubUserId = this.ReadId(responseObject["id"]);
		}

		return githubUserId;
	}

	/**
	 * Confirms the repository token can see the private target before a later
	 * permission 404 is interpreted as contributor access denial.
	 *
	 * @param repository The operator-allowlisted repository to preflight.
	 */
	private async CheckRepository(repository: RepositoryTarget): Promise<void>
	{
		const requestUrl: string = this.GetRepositoryUrl(repository);
		const response: Response = await fetch(requestUrl, this.GetRequest());
		this.EnsureSuccess(response);
	}

	/**
	 * Reads the contributor's highest effective base permission after repository
	 * visibility is established. GitHub permission 404 then safely means the
	 * resolved user lacks repository access rather than the App lacking access.
	 *
	 * @param githubUsername The resolved contributor login.
	 * @param repository The visible operator-allowlisted repository.
	 * @param githubUserId The immutable identity resolved before permission lookup.
	 * @returns Eligible for write/admin, otherwise insufficient access.
	 */
	private async CheckPermission(githubUsername: string, repository: RepositoryTarget, githubUserId: number): Promise<EligibilityResult>
	{
		const requestUrl: string = this.GetRepositoryUrl(repository) + "/collaborators/" + encodeURIComponent(githubUsername) + "/permission";
		const response: Response = await fetch(requestUrl, this.GetRequest());
		let result: EligibilityResult;

		if (response.status === 404)
		{
			result = this.CreateResult(EligibilityOutcome.InsufficientAccess, undefined);
		}
		else
		{
			this.EnsureSuccess(response);
			const responseObject: JsonObject = await this.ReadResponse(response, "GitHub permission response");
			const permission: string = this.ReadString(responseObject["permission"], "permission");
			const permissionAccepted: boolean = permission === "write" || permission === "admin";

			if (permissionAccepted)
			{
				result = this.CreateResult(EligibilityOutcome.Eligible, githubUserId);
			}
			else
			{
				result = this.CreateResult(EligibilityOutcome.InsufficientAccess, undefined);
			}
		}

		return result;
	}

	/**
	 * Creates required authenticated headers without exposing the token in URLs
	 * or failure messages.
	 *
	 * @returns A GitHub REST GET request with versioned JSON headers.
	 */
	private GetRequest(): RequestInit
	{
		const request: RequestInit =
			{
				method: "GET",
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
	 * Builds the encoded base REST URL for one trusted repository identity.
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
	 * Rejects any status outside the successful HTTP range without reading or
	 * exposing an external response body.
	 *
	 * @param response The GitHub response whose status is being checked.
	 */
	private EnsureSuccess(response: Response): void
	{
		if (!response.ok)
		{
			throw new Error("GitHub access verification failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Parses one successful response and requires a non-null JSON object.
	 *
	 * @param response The successful GitHub response to parse.
	 * @param fieldPath The response name used only in sanitized errors.
	 * @returns The validated top-level JSON object.
	 */
	private async ReadResponse(response: Response, fieldPath: string): Promise<JsonObject>
	{
		const responseValue: unknown = await response.json();

		if (typeof responseValue !== "object" || responseValue === null || Array.isArray(responseValue))
		{
			throw new Error(fieldPath + " must be an object.");
		}

		return responseValue as JsonObject;
	}

	/**
	 * Reads a positive safe integer identity from an untrusted GitHub payload.
	 *
	 * @param input The unknown user ID response field.
	 * @returns The validated immutable numeric GitHub identity.
	 */
	private ReadId(input: unknown): number
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
		{
			throw new Error("GitHub user response id must be a positive safe integer.");
		}

		return input;
	}

	/**
	 * Reads a required nonempty string from an untrusted GitHub payload.
	 *
	 * @param input The unknown response field value.
	 * @param fieldPath The response field used in sanitized errors.
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
	 * Creates one normalized result without retaining GitHub payload objects.
	 *
	 * @param outcome The approved eligibility category.
	 * @param githubUserId The immutable identity supplied only for eligibility.
	 * @returns A complete normalized contributor eligibility result.
	 */
	private CreateResult(outcome: EligibilityOutcome, githubUserId: number | undefined): EligibilityResult
	{
		const result: EligibilityResult =
			{
				outcome: outcome,
				githubUserId: githubUserId
			};

		return result;
	}
}
