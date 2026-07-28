import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { WorkItemRequest } from "../domain/WorkItemRequest.js";

/**
 * Converts a validated Stage 4 plan into structured User Story content. HTML
 * escaping prevents contributor-authored text from injecting markup into Azure
 * DevOps rich-text fields.
 */
export class WorkItemFactory
{
	/**
	 * Creates the repository-owned request values for the Azure DevOps adapter.
	 *
	 * @param actionPlan The validated non-mutating Stage 4 plan.
	 * @param config The validated destination and controlled-tag configuration.
	 * @returns Structured and escaped User Story creation values.
	 */
	public Create(actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): WorkItemRequest
	{
		const submissionId: string = this.Escape(actionPlan.submissionId);
		const summary: string = this.Escape(actionPlan.summary);
		const repository: string = this.Escape(actionPlan.repositoryOwner + "/" + actionPlan.repositoryName);
		const articlePath: string = this.Escape(actionPlan.articlePath);
		const approver: string = this.Escape(actionPlan.approver);
		const approvalMode: string = this.Escape(actionPlan.approvalMode);
		const description: string = "<p><strong>Submission:</strong> " + submissionId + "</p>" +
			"<p>" + summary + "</p>" +
			"<p><strong>Repository:</strong> " + repository + "</p>" +
			"<p><strong>Article path:</strong> " + articlePath + "</p>" +
			"<p><strong>Approval:</strong> " + approvalMode + " by " + approver + "</p>";
		const acceptanceCriteria: string = "<ul>" +
			"<li>The contribution for <code>" + articlePath + "</code> is submitted through GitHub.</li>" +
			"<li>Required engineering and content reviews are completed.</li>" +
			"<li>The accepted contribution is merged or the submission is explicitly withdrawn.</li>" +
			"</ul>";
		const controlledTags: string[] = [...config.tags];
		controlledTags.push(actionPlan.submissionId);
		const request: WorkItemRequest =
			{
				submissionId: actionPlan.submissionId,
				parentId: config.parentId,
				title: "[" + actionPlan.submissionId + "] " + actionPlan.title,
				description: description,
				acceptanceCriteria: acceptanceCriteria,
				storyPoints: actionPlan.storyPoints,
				tags: controlledTags.join("; ")
			};

		return request;
	}

	/**
	 * Escapes text inserted into Azure DevOps HTML fields.
	 *
	 * @param input The trusted-domain text that may contain HTML characters.
	 * @returns Text safe for inclusion in generated rich-text markup.
	 */
	private Escape(input: string): string
	{
		let output: string = input.replace(/&/g, "&amp;");
		output = output.replace(/</g, "&lt;");
		output = output.replace(/>/g, "&gt;");
		output = output.replace(/"/g, "&quot;");
		output = output.replace(/'/g, "&#39;");

		return output;
	}
}