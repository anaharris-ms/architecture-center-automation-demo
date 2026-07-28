import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { PullRequestObservation } from "../domain/PullRequestObservation.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";

/**
 * Retrieves authoritative opened-pull-request facts and changed paths from the
 * GitHub REST API. The short-lived fork-local repository token remains in
 * request headers and external payload objects never cross the adapter.
 */
export class GitHubPullRequestLoader
{
	private readonly config: GitHubAccessConfig;

	/**
	 * Creates the event adapter with a token authorized for the event repository.
	 *
	 * @param config The short-lived fork-local repository-token configuration.
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
	 * Retrieves one pull request from GitHub using only the trusted repository
	 * identity and number supplied by the automation receiver. Re-fetching the
	 * complete pull request prevents the contributor repository from asserting
	 * author, branch, title, body, or base-repository facts in dispatch inputs.
	 *
	 * @param repository The validated repository selected by the receiver.
	 * @param pullRequestNumber The positive pull-request number to retrieve.
	 * @returns An authoritative observation enriched with every changed path.
	 */
	public async LoadPullRequest(
		repository: RepositoryTarget,
		pullRequestNumber: number): Promise<PullRequestObservation>
	{
		this.ValidateRepository(repository);
		this.ValidateNumber(pullRequestNumber);
		const requestUrl: string = this.GetPullUrl(repository, pullRequestNumber);
		const response: Response = await fetch(requestUrl, this.GetRequest());
		this.EnsureSuccess(response, "details");
		const responseValue: unknown = await response.json();
		const pullRequest: JsonObject = this.ReadObject(responseValue, "GitHub pull request");
		const responseNumber: number = this.ReadNumber(pullRequest["number"], "pull_request.number");

		if (responseNumber !== pullRequestNumber)
		{
			throw new Error("GitHub pull-request response number does not match the requested number.");
		}

		const observation: PullRequestObservation = await this.CreateObservation(pullRequest, repository);

		return observation;
	}

	/**
	 * Converts authoritative GitHub pull-request fields into the repository-owned
	 * observation and verifies the returned base repository is exactly the target
	 * selected by the trusted receiver before changed files are requested.
	 *
	 * @param pullRequest The validated external pull-request response object.
	 * @param repository The trusted repository requested by the receiver.
	 * @returns A normalized observation enriched with changed file paths.
	 */
	private async CreateObservation(
		pullRequest: JsonObject,
		repository: RepositoryTarget): Promise<PullRequestObservation>
	{
		const pullRequestNumber: number = this.ReadNumber(pullRequest["number"], "pull_request.number");
		const user: JsonObject = this.ReadObject(pullRequest["user"], "pull_request.user");
		const authorUserId: number = this.ReadNumber(user["id"], "pull_request.user.id");
		const base: JsonObject = this.ReadObject(pullRequest["base"], "pull_request.base");
		const repositoryObject: JsonObject = this.ReadObject(base["repo"], "pull_request.base.repo");
		const ownerObject: JsonObject = this.ReadObject(repositoryObject["owner"], "pull_request.base.repo.owner");
		const responseOwner: string = this.ReadString(ownerObject["login"], "pull_request.base.repo.owner.login");
		const responseName: string = this.ReadString(repositoryObject["name"], "pull_request.base.repo.name");

		if (responseOwner !== repository.owner || responseName !== repository.name)
		{
			throw new Error("GitHub pull-request base repository does not match the requested repository.");
		}

		const head: JsonObject = this.ReadObject(pullRequest["head"], "pull_request.head");
		const headBranch: string = this.ReadString(head["ref"], "pull_request.head.ref");
		const headCommitSha: string = this.ReadSha(head["sha"], "pull_request.head.sha");
		const title: string = this.ReadString(pullRequest["title"], "pull_request.title");
		const body: string = this.ReadBody(pullRequest["body"]);
		const changedPaths: string[] = await this.GetChangedPaths(repository, pullRequestNumber);
		const observation: PullRequestObservation =
			{
				pullRequestNumber: pullRequestNumber,
				authorUserId: authorUserId,
				repository: repository,
				headBranch: headBranch,
				headCommitSha: headCommitSha,
				title: title,
				body: body,
				changedPaths: changedPaths
			};

		return observation;
	}

	/**
	 * Reads and normalizes one authoritative full Git commit SHA from GitHub.
	 *
	 * @param input The unknown response field expected to contain a SHA.
	 * @param fieldPath The response path included in sanitized validation errors.
	 * @returns The normalized lowercase full commit SHA.
	 */
	private ReadSha(input: unknown, fieldPath: string): string
	{
		const commitSha: string = this.ReadString(input, fieldPath);
		const shaPattern: RegExp = /^[0-9a-fA-F]{40}$/;

		if (!shaPattern.test(commitSha))
		{
			throw new Error(fieldPath + " must be a full Git commit SHA.");
		}

		return commitSha.toLowerCase();
	}

	/**
	 * Retrieves changed files in 100-item pages up to GitHub's documented 3,000
	 * file cap and rejects malformed filename entries before normalization.
	 *
	 * @param repository The validated base repository from the event payload.
	 * @param pullRequestNumber The validated positive pull-request number.
	 * @returns Distinct changed repository-relative paths in GitHub order.
	 */
	private async GetChangedPaths(
		repository: RepositoryTarget,
		pullRequestNumber: number): Promise<string[]>
	{
		const changedPaths: string[] = [];
		let pageNumber: number = 1;
		let pageComplete: boolean = false;

		while (!pageComplete && pageNumber <= 30)
		{
			const requestUrl: string = this.GetFilesUrl(repository, pullRequestNumber, pageNumber);
			const response: Response = await fetch(requestUrl, this.GetRequest());
			this.EnsureSuccess(response, "files");
			const fileObjects: JsonObject[] = await this.ReadFiles(response);

			for (const fileObject of fileObjects)
			{
				const changedPath: string = this.ReadString(fileObject["filename"], "files.filename");

				if (!changedPaths.includes(changedPath))
				{
					changedPaths.push(changedPath);
				}
			}

			pageComplete = fileObjects.length < 100;
			pageNumber += 1;
		}

		return changedPaths;
	}

	/**
	 * Creates the authenticated versioned request used for changed-file pages.
	 *
	 * @returns A GitHub REST GET request with the repository token in headers.
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
	 * Builds one encoded changed-files endpoint with explicit pagination values.
	 *
	 * @param repository The validated base repository identity.
	 * @param pullRequestNumber The positive pull-request number.
	 * @param pageNumber The one-based changed-files page number.
	 * @returns The complete GitHub REST endpoint URL.
	 */
	private GetFilesUrl(
		repository: RepositoryTarget,
		pullRequestNumber: number,
		pageNumber: number): string
	{
		const owner: string = encodeURIComponent(repository.owner);
		const name: string = encodeURIComponent(repository.name);
		const requestUrl: string = "https://api.github.com/repos/"
			+ owner
			+ "/"
			+ name
			+ "/pulls/"
			+ pullRequestNumber.toString()
			+ "/files?per_page=100&page="
			+ pageNumber.toString();

		return requestUrl;
	}

	/**
	 * Builds the authoritative pull-request details endpoint from the receiver's
	 * validated repository identity and positive pull-request number.
	 *
	 * @param repository The repository selected by the trusted receiver.
	 * @param pullRequestNumber The positive pull-request number to retrieve.
	 * @returns The complete GitHub REST endpoint URL.
	 */
	private GetPullUrl(repository: RepositoryTarget, pullRequestNumber: number): string
	{
		const owner: string = encodeURIComponent(repository.owner);
		const name: string = encodeURIComponent(repository.name);
		const requestUrl: string = "https://api.github.com/repos/"
			+ owner
			+ "/"
			+ name
			+ "/pulls/"
			+ pullRequestNumber.toString();

		return requestUrl;
	}

	/**
	 * Rejects unsuccessful changed-file responses without reading or exposing the
	 * external body or runtime authorization header.
	 *
	 * @param response The GitHub response whose status is being checked.
	 * @param resource The sanitized resource name used in the failure message.
	 */
	private EnsureSuccess(response: Response, resource: string): void
	{
		if (!response.ok)
		{
			throw new Error("GitHub pull-request " + resource + " request failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Requires both components of a receiver-selected repository identity before
	 * either value is encoded into an external GitHub API request.
	 *
	 * @param repository The repository target supplied by the receiver parser.
	 */
	private ValidateRepository(repository: RepositoryTarget): void
	{
		if (repository.owner.trim().length === 0 || repository.name.trim().length === 0)
		{
			throw new Error("GitHub pull-request repository must include a nonempty owner and name.");
		}
	}

	/**
	 * Requires a positive safe pull-request number at the trusted receiver API
	 * boundary so malformed dispatch inputs never become GitHub request paths.
	 *
	 * @param pullRequestNumber The receiver-supplied pull-request number.
	 */
	private ValidateNumber(pullRequestNumber: number): void
	{
		if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber < 1)
		{
			throw new Error("GitHub pull-request number must be a positive safe integer.");
		}
	}

	/**
	 * Parses one successful changed-file page and validates every array item as a
	 * non-null object before individual filename fields are read.
	 *
	 * @param response The successful GitHub changed-files response.
	 * @returns The validated external file objects retained only in this adapter.
	 */
	private async ReadFiles(response: Response): Promise<JsonObject[]>
	{
		const responseValue: unknown = await response.json();

		if (!Array.isArray(responseValue))
		{
			throw new Error("GitHub pull-request files response must be an array.");
		}

		const fileObjects: JsonObject[] = [];

		for (const fileValue of responseValue)
		{
			fileObjects.push(this.ReadObject(fileValue, "GitHub pull-request file"));
		}

		return fileObjects;
	}

	/**
	 * Requires a non-null, non-array object from an untrusted event or response.
	 *
	 * @param input The unknown external value expected to contain an object.
	 * @param fieldPath The sanitized field description used in validation errors.
	 * @returns The validated external JSON object.
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
	 * Requires a nonempty string from an untrusted event or response field.
	 *
	 * @param input The unknown external field value.
	 * @param fieldPath The sanitized field path used in validation errors.
	 * @returns The validated nonempty string without normalization.
	 */
	private ReadString(input: unknown, fieldPath: string): string
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			throw new Error("GitHub response " + fieldPath + " must be a nonempty string.");
		}

		return input;
	}

	/**
	 * Requires a positive safe integer from an untrusted event field.
	 *
	 * @param input The unknown external numeric value.
	 * @param fieldPath The sanitized field path used in validation errors.
	 * @returns The validated positive safe integer.
	 */
	private ReadNumber(input: unknown, fieldPath: string): number
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
		{
			throw new Error("GitHub response " + fieldPath + " must be a positive safe integer.");
		}

		return input;
	}

	/**
	 * Normalizes GitHub's nullable pull-request body to the domain's empty-string
	 * representation while rejecting every other external type.
	 *
	 * @param input The unknown nullable body field from the event payload.
	 * @returns The contributor-authored body or an empty string when null.
	 */
	private ReadBody(input: unknown): string
	{
		let body: string = "";

		if (typeof input === "string")
		{
			body = input;
		}
		else if (input !== null)
		{
			throw new Error("GitHub response pull_request.body must be a string or null.");
		}

		return body;
	}
}