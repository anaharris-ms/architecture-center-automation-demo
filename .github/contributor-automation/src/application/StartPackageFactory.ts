import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";

/**
 * Creates deterministic contributor instructions from validated intake and
 * the correlated Azure DevOps identifier. The factory performs no persistence,
 * network access, or rendering, so plan and apply orchestration can reuse the
 * same values without exposing external payload contracts.
 */
export class StartPackageFactory
{
	/**
	 * Builds branch, repository, editor, pull-request, and work-item values for
	 * one submission. URL path segments are encoded independently so repository
	 * identity remains structurally intact while unsafe characters are escaped.
	 *
	 * @param submission The normalized contributor submission.
	 * @param config The validated Azure DevOps destination configuration.
	 * @param workItemId The correlated Azure DevOps work-item identifier.
	 * @returns A complete deterministic start-contribution package model.
	 */
	public Create(submission: Submission, config: AzureDevOpsConfig, workItemId: number): StartPackage
	{
		const owner: string = encodeURIComponent(submission.repository.owner);
		const repository: string = encodeURIComponent(submission.repository.name);
		const organization: string = encodeURIComponent(config.organization);
		const project: string = encodeURIComponent(config.project);
		const repositoryUrl: string = "https://github.com/" + owner + "/" + repository + ".git";
		const branchName: string = "contrib/" + submission.submissionId;
		const branchPath: string = this.EncodePath(branchName);
		const articlePath: string = this.EncodePath(submission.articlePath);
		const webEditorUrl: string = "https://github.dev/" + owner + "/" + repository + "/blob/" + branchPath + "/" + articlePath;
		const startPackage: StartPackage =
			{
				submissionId: submission.submissionId,
				branchName: branchName,
				webEditorUrl: webEditorUrl,
				repositoryUrl: repositoryUrl,
				articlePath: submission.articlePath,
				pullRequestTitle: "[" + submission.submissionId + "] " + submission.proposal.title,
				workItemUrl: "https://dev.azure.com/" + organization + "/" + project + "/_workitems/edit/" + workItemId.toString()
			};

		return startPackage;
	}

	/**
	 * Encodes every slash-delimited GitHub route segment independently. Keeping
	 * branch and article separators intact lets github.dev resolve a prepared
	 * branch containing a slash and open the requested repository-relative file.
	 *
	 * @param value The branch name or article path to encode for a GitHub route.
	 * @returns The encoded route with structural slash separators preserved.
	 */
	private EncodePath(value: string): string
	{
		const pathParts: string[] = value.split("/");
		const encodedParts: string[] = [];

		for (const pathPart of pathParts)
		{
			encodedParts.push(encodeURIComponent(pathPart));
		}

		return encodedParts.join("/");
	}
}