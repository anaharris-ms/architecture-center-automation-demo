import type { PullRequestReceiverCommand } from "../application/PullRequestReceiverCommand.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { PullRequestReceiverResult } from "./PullRequestReceiverResult.js";

/**
 * Parses the minimal routing values accepted from cross-repository workflow
 * dispatch. It validates syntax only; the composition root separately requires
 * an exact allowlist match before any GitHub repository-token use.
 */
export class PullRequestReceiverParser
{
	/**
	 * Requires repository and pull-request flags in a fixed explicit order so
	 * unknown, duplicated, empty, fractional, or unsafe values are rejected.
	 *
	 * @param commandArguments The arguments following the receiver entry point.
	 * @returns A validated routing command or stable usage error.
	 */
	public Parse(commandArguments: string[]): PullRequestReceiverResult
	{
		let command: PullRequestReceiverCommand | undefined = undefined;
		let errorMessage: string | undefined = undefined;
		const repositoryFlag: string | undefined = commandArguments[0];
		const repositoryValue: string | undefined = commandArguments[1];
		const pullRequestFlag: string | undefined = commandArguments[2];
		const pullRequestValue: string | undefined = commandArguments[3];
		const repository: RepositoryTarget | undefined = this.ParseRepository(repositoryValue);
		const pullRequestNumber: number | undefined = this.ParseNumber(pullRequestValue);

		if (commandArguments.length !== 4
			|| repositoryFlag !== "--repository"
			|| pullRequestFlag !== "--pull-request"
			|| repository === undefined
			|| pullRequestNumber === undefined)
		{
			errorMessage = "Usage: --repository <owner/name> --pull-request <number>.";
		}
		else
		{
			command =
				{
					repository: repository,
					pullRequestNumber: pullRequestNumber
				};
		}

		const result: PullRequestReceiverResult =
			{
				command: command,
				errorMessage: errorMessage
			};

		return result;
	}

	/**
	 * Splits one owner/name value into a simple repository target and rejects
	 * extra separators or blank components before external requests are built.
	 *
	 * @param repositoryValue The untrusted workflow dispatch repository value.
	 * @returns A repository target, or undefined when syntax is invalid.
	 */
	private ParseRepository(repositoryValue: string | undefined): RepositoryTarget | undefined
	{
		let repository: RepositoryTarget | undefined = undefined;

		if (repositoryValue !== undefined)
		{
			const parts: string[] = repositoryValue.split("/");
			const owner: string | undefined = parts[0];
			const name: string | undefined = parts[1];

			if (parts.length === 2
				&& owner !== undefined
				&& owner.trim().length > 0
				&& name !== undefined
				&& name.trim().length > 0)
			{
				repository =
					{
						owner: owner,
						name: name
					};
			}
		}

		return repository;
	}

	/**
	 * Converts one decimal workflow input to a positive safe integer without
	 * accepting signs, fractions, exponents, whitespace, or partial numbers.
	 *
	 * @param pullRequestValue The untrusted workflow dispatch number text.
	 * @returns A positive safe integer, or undefined when syntax is invalid.
	 */
	private ParseNumber(pullRequestValue: string | undefined): number | undefined
	{
		let pullRequestNumber: number | undefined = undefined;

		if (pullRequestValue !== undefined && /^[1-9][0-9]*$/u.test(pullRequestValue))
		{
			const parsedNumber: number = Number(pullRequestValue);

			if (Number.isSafeInteger(parsedNumber))
			{
				pullRequestNumber = parsedNumber;
			}
		}

		return pullRequestNumber;
	}
}