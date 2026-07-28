import type { Submission } from "../domain/Submission.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionState } from "../domain/SubmissionState.js";

/**
 * Creates the initial canonical state record from one validated contributor
 * submission. External identifiers remain undefined until later apply-mode
 * stages create or detect the corresponding Azure DevOps and GitHub records.
 */
export class SubmissionStateFactory
{
	private readonly defaultAssignee: string;

	/**
	 * Creates a state factory with the one temporary assignee who initially
	 * fills every review and publishing role. Individual persisted roles can be
	 * reassigned later without changing this initialization setting.
	 *
	 * @param defaultAssignee The Microsoft email initially assigned to all roles.
	 */
	public constructor(defaultAssignee: string)
	{
		if (!/^[^\s@]+@microsoft\.com$/i.test(defaultAssignee))
		{
			throw new Error("The default assignee must be a Microsoft email address.");
		}

		this.defaultAssignee = defaultAssignee;
	}

	/**
	 * Copies durable intake correlation into a new revision-zero state record.
	 * The first successful store save assigns revision one.
	 *
	 * @param submission The normalized and validated Stage 2 submission.
	 * @returns A complete initial canonical state record.
	 */
	public Create(submission: Submission): SubmissionState
	{
		const state: SubmissionState =
			{
				submissionId: submission.submissionId,
				azureDevOpsId: undefined,
				githubUserId: undefined,
				repository:
					{
						owner: submission.repository.owner,
						name: submission.repository.name
					},
				branchName: undefined,
				initialCommitSha: undefined,
				articlePath: submission.articlePath,
				pullRequestNumber: undefined,
				currentStage: SubmissionStage.Intake,
				reviewState:
					{
						resumeStage: undefined,
						openedCommitSha: undefined,
						history: []
					},
				assignments:
					{
						technicalReviewer: this.defaultAssignee,
						contentReviewer: this.defaultAssignee,
						editorialReviewer: this.defaultAssignee,
						publisher: this.defaultAssignee
					},
				completedActions: [],
				reminderHistory: [],
				revision: 0
			};

		return state;
	}
}