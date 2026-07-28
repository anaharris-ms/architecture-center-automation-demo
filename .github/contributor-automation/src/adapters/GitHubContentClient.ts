import { ContentConflictError } from "../application/ContentConflictError.js";
import type { GitHubStateConfig } from "../contracts/GitHubStateConfig.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { StateContent } from "../contracts/StateContent.js";
import type { StateContentClient } from "../ports/StateContentClient.js";

/**
 * Adapts the GitHub Contents REST API to revision-aware UTF-8 text operations.
 * GitHub payloads, Base64 encoding, authentication, branch selection, and SHA
 * conflict responses remain contained within this infrastructure boundary.
 */
export class GitHubContentClient implements StateContentClient
{
	private readonly config: GitHubStateConfig;

	/**
	 * Creates a client for one automation repository and dedicated state branch.
	 *
	 * @param config The repository, branch, and authentication configuration.
	 */
	public constructor(config: GitHubStateConfig)
	{
		this.config = config;
	}

	/**
	 * Reads and decodes one GitHub content document at the configured branch.
	 *
	 * @param contentPath The repository-relative document path.
	 * @returns The decoded document and SHA, or undefined for HTTP 404.
	 */
	public async Read(contentPath: string): Promise<StateContent | undefined>
	{
		const requestUrl: string = this.GetUrl(contentPath) + "?ref=" + encodeURIComponent(this.config.branch);
		const response: Response = await fetch(requestUrl, this.GetRequest("GET"));
		let result: StateContent | undefined;

		if (response.status === 404)
		{
			result = undefined;
		}
		else
		{
			await this.EnsureSuccess(response);
			const responseValue: unknown = await response.json();
			const responseObject: JsonObject = this.ReadObject(responseValue, "GitHub content response");
			const encodedContent: string = this.ReadString(responseObject["content"], "content");
			const contentText: string = Buffer.from(encodedContent.replace(/\n/g, ""), "base64").toString("utf8");
			result =
				{
					path: this.ReadString(responseObject["path"], "path"),
					content: contentText,
					revision: this.ReadString(responseObject["sha"], "sha")
				};
		}

		return result;
	}

	/**
	 * Lists file paths returned for one GitHub repository directory.
	 *
	 * @param directoryPath The repository-relative directory path.
	 * @returns Sorted paths for direct file entries only.
	 */
	public async List(directoryPath: string): Promise<string[]>
	{
		const requestUrl: string = this.GetUrl(directoryPath) + "?ref=" + encodeURIComponent(this.config.branch);
		const response: Response = await fetch(requestUrl, this.GetRequest("GET"));
		const paths: string[] = [];

		if (response.status !== 404)
		{
			await this.EnsureSuccess(response);
			const responseValue: unknown = await response.json();

			if (!Array.isArray(responseValue))
			{
				throw new Error("GitHub directory response must be an array.");
			}

			for (const item of responseValue)
			{
				const itemObject: JsonObject = this.ReadObject(item, "GitHub directory item");
				const itemType: string = this.ReadString(itemObject["type"], "type");

				if (itemType === "file")
				{
					paths.push(this.ReadString(itemObject["path"], "path"));
				}
			}
		}

		paths.sort();

		return paths;
	}

	/**
	 * Creates or updates one GitHub content document on the configured branch.
	 * GitHub requires the previously observed SHA for updates and responds with a
	 * conflict when another workflow writes the document first.
	 *
	 * @param contentPath The repository-relative document path.
	 * @param content The complete UTF-8 document content.
	 * @param expectedRevision The previously observed GitHub content SHA.
	 * @param message The Git commit message for this state change.
	 * @returns The saved content and newly assigned GitHub content SHA.
	 */
	public async Write(contentPath: string, content: string, expectedRevision: string | undefined, message: string): Promise<StateContent>
	{
		const requestBody: JsonObject =
			{
				message: message,
				content: Buffer.from(content, "utf8").toString("base64"),
				branch: this.config.branch
			};

		if (expectedRevision !== undefined)
		{
			requestBody["sha"] = expectedRevision;
		}

		const request: RequestInit = this.GetRequest("PUT");
		request.body = JSON.stringify(requestBody);
		const response: Response = await fetch(this.GetUrl(contentPath), request);

		if (response.status === 409 || response.status === 422)
		{
			throw new ContentConflictError(contentPath);
		}

		await this.EnsureSuccess(response);
		const responseValue: unknown = await response.json();
		const responseObject: JsonObject = this.ReadObject(responseValue, "GitHub write response");
		const contentObject: JsonObject = this.ReadObject(responseObject["content"], "content");
		const savedContent: StateContent =
			{
				path: this.ReadString(contentObject["path"], "content.path"),
				content: content,
				revision: this.ReadString(contentObject["sha"], "content.sha")
			};

		return savedContent;
	}

	/**
	 * Creates one authenticated GitHub API request without exposing the token in
	 * URLs, state records, or error text.
	 *
	 * @param method The HTTP method for the GitHub API operation.
	 * @returns The request initialization with required GitHub headers.
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
	 * Builds an encoded GitHub Contents API URL for one repository-relative path.
	 *
	 * @param contentPath The repository-relative path to address.
	 * @returns The complete GitHub REST endpoint URL.
	 */
	private GetUrl(contentPath: string): string
	{
		const pathParts: string[] = contentPath.split("/");
		const encodedParts: string[] = [];

		for (const pathPart of pathParts)
		{
			encodedParts.push(encodeURIComponent(pathPart));
		}

		return "https://api.github.com/repos/" + encodeURIComponent(this.config.owner) + "/" + encodeURIComponent(this.config.repository) + "/contents/" + encodedParts.join("/");
	}

	/**
	 * Rejects unsuccessful GitHub responses with a sanitized status-only error.
	 *
	 * @param response The GitHub HTTP response to inspect.
	 */
	private async EnsureSuccess(response: Response): Promise<void>
	{
		if (!response.ok)
		{
			throw new Error("GitHub Contents API request failed with HTTP " + response.status.toString() + ".");
		}

		await Promise.resolve();
	}

	/**
	 * Reads an object from an untrusted GitHub response payload.
	 *
	 * @param input The unknown response value.
	 * @param fieldPath The response field used in errors.
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
	 * Reads a required string from an untrusted GitHub response payload.
	 *
	 * @param input The unknown response field value.
	 * @param fieldPath The response field used in errors.
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
}