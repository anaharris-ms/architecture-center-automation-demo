import type { PullRequestObservation } from "../domain/PullRequestObservation.js";
import { PullRequestOutcome } from "../domain/PullRequestOutcome.js";
import type { PullRequestResult } from "../domain/PullRequestResult.js";
import type { OutputWriter } from "../ports/OutputWriter.js";
import type { PullRequestApplier } from "../ports/PullRequestApplier.js";

/**
 * Coordinates one opened pull-request event through normalization, correlation,
 * canonical persistence, and stable operator-visible outcome reporting.
 */
export class PullRequestApplication
{
	private readonly outputWriter: OutputWriter;
	private readonly pullRequestApplier: PullRequestApplier;

	/**
	 * Creates authoritative observation orchestration from behavior and output
	 * ports.
	 *
	 * @param outputWriter The destination for sanitized classification messages.
	 * @param pullRequestApplier The canonical correlation and persistence boundary.
	 */
	public constructor(
		outputWriter: OutputWriter,
		pullRequestApplier: PullRequestApplier)
	{
		this.outputWriter = outputWriter;
		this.pullRequestApplier = pullRequestApplier;
	}

	/**
	 * Correlates and reports one already normalized observation. The trusted
	 * receiver uses this path after re-fetching pull-request facts from GitHub.
	 *
	 * @param observation The authoritative normalized pull-request facts.
	 * @returns Zero for a reported classification or one for processing failure.
	 */
	public async RunObservation(observation: PullRequestObservation): Promise<number>
	{
		let exitCode: number = 1;

		try
		{
			const result: PullRequestResult = await this.pullRequestApplier.Apply(observation);
			const message: string = this.GetMessage(result);
			this.outputWriter.Write(message);
			exitCode = 0;
		}
		catch (error: unknown)
		{
			this.WriteFailure(error);
		}

		return exitCode;
	}

	/**
	 * Maps one explicit correlation result to stable output without exposing event
	 * payloads, credentials, state documents, or implementation diagnostics.
	 *
	 * @param result The deterministic correlation classification to report.
	 * @returns One sanitized operator-visible result message.
	 */
	private GetMessage(result: PullRequestResult): string
	{
		let message: string = "Pull request was not matched to a submission.";

		if (result.outcome === PullRequestOutcome.Matched)
		{
			if (result.submissionId === undefined)
			{
				throw new Error("Matched pull-request result requires a submission ID.");
			}

			message = "Pull request matched submission " + result.submissionId + ".";
		}
		else if (result.outcome === PullRequestOutcome.Ambiguous)
		{
			message = "Pull request correlation is ambiguous.";
		}

		return message;
	}

	/**
	 * Converts an unknown technical failure into one stable operator-visible
	 * message without exposing credentials, state documents, or API payloads.
	 *
	 * @param error The unknown loader or correlation failure to report.
	 */
	private WriteFailure(error: unknown): void
	{
		let errorMessage: string = "Pull-request processing failed with an unknown error.";

		if (error instanceof Error)
		{
			errorMessage = "Pull-request processing failed: " + error.message;
		}

		this.outputWriter.Write(errorMessage);
	}
}