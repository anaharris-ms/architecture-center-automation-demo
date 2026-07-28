import type { FauxContributorData } from "../contracts/FauxContributorData.js";
import type { FauxProposalData } from "../contracts/FauxProposalData.js";
import type { FauxRepositoryData } from "../contracts/FauxRepositoryData.js";
import type { FauxSubmissionData } from "../contracts/FauxSubmissionData.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import { SubmissionType } from "../domain/SubmissionType.js";
import type { SubmissionResult } from "./SubmissionResult.js";

/**
 * Validates untrusted faux intake JSON before it reaches pipeline-owned models.
 * The validator rejects missing and unknown fields, unsafe article paths, and
 * malformed contributor or repository identity without relying on an external
 * package with unresolved security advisories.
 */
export class SubmissionValidator
{
	/**
	 * Reviews an unknown JSON value against the complete faux submission
	 * contract. Validation findings are accumulated in deterministic field order
	 * so users can repair all reported intake problems together.
	 *
	 * @param input The untrusted value returned by a submission source adapter.
	 * @returns A typed faux contract when valid, otherwise ordered errors.
	 */
	public Validate(input: unknown): SubmissionResult
	{
		const errors: string[] = [];
		let value: FauxSubmissionData | undefined = undefined;

		if (!this.IsObject(input))
		{
			errors.push("The submission must be a JSON object.");
		}
		else
		{
			this.CheckRoot(input, errors);

			if (errors.length === 0)
			{
				value = this.BuildValue(input);
			}
		}

		const result: SubmissionResult =
			{
				value: value,
				errors: errors
			};

		return result;
	}

	/**
	 * Validates root fields and delegates nested objects to focused checks. The
	 * explicit field list also rejects accidental external fields before they
	 * can become undocumented pipeline behavior.
	 *
	 * @param input The root JSON object being validated.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckRoot(input: JsonObject, errors: string[]): void
	{
		const allowedFields: string[] =
			[
				"submissionNumber",
				"contributor",
				"submissionType",
				"repository",
				"articlePath",
				"proposal"
			];
		this.CheckFields(input, allowedFields, "submission", errors);
		this.CheckInteger(input["submissionNumber"], "submissionNumber", errors);
		this.CheckContributor(input["contributor"], errors);
		this.CheckType(input["submissionType"], errors);
		this.CheckRepository(input["repository"], errors);
		this.CheckArticle(input["articlePath"], errors);
		this.CheckProposal(input["proposal"], errors);
	}

	/**
	 * Validates contributor identity needed for future communication and GitHub
	 * matching. Email and username checks intentionally cover syntax only and do
	 * not claim that an external identity exists.
	 *
	 * @param input The untrusted contributor value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckContributor(input: unknown, errors: string[]): void
	{
		if (!this.IsObject(input))
		{
			errors.push("contributor must be an object.");
		}
		else
		{
			const allowedFields: string[] = ["name", "email", "githubUsername"];
			this.CheckFields(input, allowedFields, "contributor", errors);
			this.CheckText(input["name"], "contributor.name", errors);
			this.CheckEmail(input["email"], errors);
			this.CheckUsername(input["githubUsername"], errors);
		}
	}

	/**
	 * Validates the declared submission category against the two values supported
	 * by the contributor pipeline. Classification rules are applied later and
	 * are not embedded in this structural boundary check.
	 *
	 * @param input The untrusted submission-type value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckType(input: unknown, errors: string[]): void
	{
		if (input !== SubmissionType.Update && input !== SubmissionType.NewContent)
		{
			errors.push("submissionType must be update or new-content.");
		}
	}

	/**
	 * Validates the split GitHub repository identity used by later adapters. The
	 * accepted syntax supports standard account and repository names without
	 * accepting complete URLs or path separators.
	 *
	 * @param input The untrusted repository value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckRepository(input: unknown, errors: string[]): void
	{
		if (!this.IsObject(input))
		{
			errors.push("repository must be an object.");
		}
		else
		{
			const allowedFields: string[] = ["owner", "name"];
			this.CheckFields(input, allowedFields, "repository", errors);
			this.CheckName(input["owner"], "repository.owner", errors);
			this.CheckName(input["name"], "repository.name", errors);
		}
	}

	/**
	 * Validates a repository-relative Markdown path and rejects absolute paths,
	 * Windows separators, and parent traversal. This prevents a later file
	 * adapter from interpreting intake as an arbitrary file-system location.
	 *
	 * @param input The untrusted article-path value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckArticle(input: unknown, errors: string[]): void
	{
		this.CheckText(input, "articlePath", errors);

		if (typeof input === "string")
		{
			const articlePath: string = input.trim();
			const pathSegments: string[] = articlePath.split("/");
			let hasParentSegment: boolean = false;

			for (const pathSegment of pathSegments)
			{
				if (pathSegment === "..")
				{
					hasParentSegment = true;
				}
			}

			if (articlePath.startsWith("/") || articlePath.includes("\\") || hasParentSegment || !articlePath.endsWith(".md"))
			{
				errors.push("articlePath must be a safe repository-relative Markdown path.");
			}
		}
	}

	/**
	 * Validates the human-authored proposal title and summary. The values remain
	 * presentation-neutral so later Azure DevOps, GitHub, and email adapters can
	 * format them without parsing a combined text block.
	 *
	 * @param input The untrusted proposal value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckProposal(input: unknown, errors: string[]): void
	{
		if (!this.IsObject(input))
		{
			errors.push("proposal must be an object.");
		}
		else
		{
			const allowedFields: string[] = ["title", "summary"];
			this.CheckFields(input, allowedFields, "proposal", errors);
			this.CheckText(input["title"], "proposal.title", errors);
			this.CheckText(input["summary"], "proposal.summary", errors);
		}
	}

	/**
	 * Rejects missing and additional fields for one JSON object. Exact contracts
	 * make fixture mistakes visible and prevent new behavior from appearing
	 * without corresponding models, documentation, and tests.
	 *
	 * @param input The JSON object whose property names are being checked.
	 * @param allowedFields The complete documented property list.
	 * @param fieldPath The human-readable object path used in errors.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckFields(input: JsonObject, allowedFields: string[], fieldPath: string, errors: string[]): void
	{
		for (const allowedField of allowedFields)
		{
			if (!(allowedField in input))
			{
				errors.push(fieldPath + "." + allowedField + " is required.");
			}
		}

		const actualFields: string[] = Object.keys(input);

		for (const actualField of actualFields)
		{
			if (!allowedFields.includes(actualField))
			{
				errors.push(fieldPath + "." + actualField + " is not supported.");
			}
		}
	}

	/**
	 * Validates a positive safe integer used to generate a stable submission ID.
	 *
	 * @param input The untrusted numeric value.
	 * @param fieldPath The human-readable field path used in errors.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckInteger(input: unknown, fieldPath: string, errors: string[]): void
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
		{
			errors.push(fieldPath + " must be a positive safe integer.");
		}
	}

	/**
	 * Validates a required, nonempty text value after whitespace trimming.
	 *
	 * @param input The untrusted text value.
	 * @param fieldPath The human-readable field path used in errors.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckText(input: unknown, fieldPath: string, errors: string[]): void
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			errors.push(fieldPath + " must be a nonempty string.");
		}
	}

	/**
	 * Validates basic email syntax for a future notification destination. Actual
	 * mailbox ownership remains outside this structural contract.
	 *
	 * @param input The untrusted contributor email value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckEmail(input: unknown, errors: string[]): void
	{
		this.CheckText(input, "contributor.email", errors);

		if (typeof input === "string")
		{
			const emailPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

			if (!emailPattern.test(input.trim()))
			{
				errors.push("contributor.email must be a valid email address.");
			}
		}
	}

	/**
	 * Validates GitHub username syntax and length for later pull-request matching.
	 *
	 * @param input The untrusted GitHub username value.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckUsername(input: unknown, errors: string[]): void
	{
		this.CheckText(input, "contributor.githubUsername", errors);

		if (typeof input === "string")
		{
			const usernamePattern: RegExp = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

			if (!usernamePattern.test(input.trim()))
			{
				errors.push("contributor.githubUsername must be a valid GitHub username.");
			}
		}
	}

	/**
	 * Validates a GitHub owner or repository name without accepting separators or
	 * complete URLs.
	 *
	 * @param input The untrusted GitHub name value.
	 * @param fieldPath The human-readable field path used in errors.
	 * @param errors The shared ordered collection of validation findings.
	 */
	private CheckName(input: unknown, fieldPath: string, errors: string[]): void
	{
		this.CheckText(input, fieldPath, errors);

		if (typeof input === "string")
		{
			const namePattern: RegExp = /^[A-Za-z0-9_.-]+$/;

			if (!namePattern.test(input.trim()))
			{
				errors.push(fieldPath + " contains unsupported characters.");
			}
		}
	}

	/**
	 * Builds the typed external contract only after every field has passed
	 * validation. Read helpers retain defensive fallbacks, but this method is
	 * unreachable while any validation finding exists.
	 *
	 * @param input The fully validated root JSON object.
	 * @returns The typed faux submission contract.
	 */
	private BuildValue(input: JsonObject): FauxSubmissionData
	{
		const contributorObject: JsonObject = this.ReadObject(input["contributor"]);
		const repositoryObject: JsonObject = this.ReadObject(input["repository"]);
		const proposalObject: JsonObject = this.ReadObject(input["proposal"]);
		const contributor: FauxContributorData =
			{
				name: this.ReadString(contributorObject["name"]),
				email: this.ReadString(contributorObject["email"]),
				githubUsername: this.ReadString(contributorObject["githubUsername"])
			};
		const repository: FauxRepositoryData =
			{
				owner: this.ReadString(repositoryObject["owner"]),
				name: this.ReadString(repositoryObject["name"])
			};
		const proposal: FauxProposalData =
			{
				title: this.ReadString(proposalObject["title"]),
				summary: this.ReadString(proposalObject["summary"])
			};
		const value: FauxSubmissionData =
			{
				submissionNumber: this.ReadNumber(input["submissionNumber"]),
				contributor: contributor,
				submissionType: this.ReadString(input["submissionType"]),
				repository: repository,
				articlePath: this.ReadString(input["articlePath"]),
				proposal: proposal
			};

		return value;
	}

	/**
	 * Determines whether an unknown value is a non-null, non-array JSON object.
	 *
	 * @param input The unknown value being inspected.
	 * @returns True when the value can be safely accessed as a JSON object.
	 */
	private IsObject(input: unknown): input is JsonObject
	{
		const isObject: boolean = typeof input === "object" && input !== null && !Array.isArray(input);

		return isObject;
	}

	/**
	 * Reads a previously validated JSON object for typed contract construction.
	 *
	 * @param input The previously validated object value.
	 * @returns The JSON object or an empty defensive fallback.
	 */
	private ReadObject(input: unknown): JsonObject
	{
		let value: JsonObject = {};

		if (this.IsObject(input))
		{
			value = input;
		}

		return value;
	}

	/**
	 * Reads and trims a previously validated string for contract construction.
	 *
	 * @param input The previously validated string value.
	 * @returns The trimmed string or an empty defensive fallback.
	 */
	private ReadString(input: unknown): string
	{
		let value: string = "";

		if (typeof input === "string")
		{
			value = input.trim();
		}

		return value;
	}

	/**
	 * Reads a previously validated number for contract construction.
	 *
	 * @param input The previously validated numeric value.
	 * @returns The number or zero as an unreachable defensive fallback.
	 */
	private ReadNumber(input: unknown): number
	{
		let value: number = 0;

		if (typeof input === "number")
		{
			value = input;
		}

		return value;
	}
}