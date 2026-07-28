import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { IntakeConfig } from "../domain/IntakeConfig.js";
import type { Submission } from "../domain/Submission.js";
import { SubmissionType } from "../domain/SubmissionType.js";
import type { ActionPlanner } from "../ports/ActionPlanner.js";

/**
 * Creates a validated Azure DevOps action plan from normalized intake and
 * external approval configuration. The planner performs no network calls and
 * contains no Azure DevOps REST field names, keeping plan mode non-mutating.
 */
export class IntakePlanner implements ActionPlanner
{
	/**
	 * Classifies the normalized submission and proposes one idempotent User Story
	 * action. Updates receive 8 points and new content receives 13 points.
	 *
	 * @param submission The normalized and validated contributor submission.
	 * @param config The validated external intake-rule configuration.
	 * @returns The typed non-mutating Azure DevOps action plan.
	 */
	public Create(submission: Submission, config: IntakeConfig): AzureDevOpsPlan
	{
		this.CheckRepository(submission, config);
		let storyPoints: number = 13;

		if (submission.submissionType === SubmissionType.Update)
		{
			storyPoints = 8;
		}

		const actionPlan: AzureDevOpsPlan =
			{
				actionKey: "ado:create-user-story",
				submissionId: submission.submissionId,
				submissionType: submission.submissionType,
				workItemType: "User Story",
				title: submission.proposal.title,
				summary: submission.proposal.summary,
				repositoryOwner: submission.repository.owner,
				repositoryName: submission.repository.name,
				articlePath: submission.articlePath,
				approver: config.defaultApprover,
				approvalMode: config.approvalMode,
				storyPoints: storyPoints
			};

		return actionPlan;
	}

	/**
	 * Requires the submission target to match an operator-approved repository.
	 * Matching follows GitHub's case-insensitive owner and repository identity.
	 *
	 * @param submission The normalized submission containing the requested target.
	 * @param config The trusted intake configuration containing allowed targets.
	 */
	private CheckRepository(submission: Submission, config: IntakeConfig): void
	{
		let repositoryAllowed: boolean = false;

		for (const repository of config.allowedRepositories)
		{
			const ownerMatches: boolean = repository.owner.toLowerCase() === submission.repository.owner.toLowerCase();
			const nameMatches: boolean = repository.name.toLowerCase() === submission.repository.name.toLowerCase();

			if (ownerMatches && nameMatches)
			{
				repositoryAllowed = true;
			}
		}

		if (!repositoryAllowed)
		{
			const repositoryName: string = submission.repository.owner + "/" + submission.repository.name;
			throw new Error("Repository " + repositoryName + " is not allowed by intake configuration.");
		}
	}
}
