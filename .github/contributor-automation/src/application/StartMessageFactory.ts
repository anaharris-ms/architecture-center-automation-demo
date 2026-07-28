import type { StartConfig } from "../domain/StartConfig.js";
import type { StartMessage } from "../domain/StartMessage.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Maps validated submission, package, and guidance values into the normalized
 * request sent to the Power Automate cloud flow. Keeping this mapping outside
 * the HTTP adapter prevents Microsoft 365 transport details from becoming the
 * pipeline's message-content contract.
 */
export class StartMessageFactory
{
	/**
	 * Creates the complete private Teams start-message context without performing
	 * network access, persistence, or presentation formatting.
	 *
	 * @param submission The validated contributor and proposal identity.
	 * @param startPackage The deterministic branch and tracking instructions.
	 * @param startConfig The validated internal support guidance destinations.
	 * @returns A normalized message for the Power Automate cloud-flow boundary.
	 */
	public Create(submission: Submission, startPackage: StartPackage, startConfig: StartConfig): StartMessage
	{
		const message: StartMessage =
			{
				submissionId: submission.submissionId,
				recipientEmail: submission.contributor.email,
				recipientName: submission.contributor.name,
				proposalTitle: submission.proposal.title,
				branchName: startPackage.branchName,
				articlePath: startPackage.articlePath,
				webEditorUrl: startPackage.webEditorUrl,
				repositoryUrl: startPackage.repositoryUrl,
				pullRequestTitle: startPackage.pullRequestTitle,
				workItemUrl: startPackage.workItemUrl,
				idWebUrl: startConfig.idWebUrl,
				accessHelpUrl: startConfig.accessHelpUrl,
				contributionOptionsUrl: startConfig.contributionOptionsUrl
			};

		return message;
	}
}