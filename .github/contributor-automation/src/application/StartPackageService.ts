import path from "node:path";
import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { ArtifactWriter } from "../ports/ArtifactWriter.js";
import type { EmailRenderer } from "../ports/EmailRenderer.js";
import type { StartPackageApplier } from "../ports/StartPackageApplier.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import type { StartPackageFactory } from "./StartPackageFactory.js";
import { StateCorrelationError } from "./StateCorrelationError.js";

/**
 * Generates the private start-work email and records its deterministic branch
 * correlation. Reruns always recreate the ephemeral artifact but avoid another
 * canonical-state write after the branch and action key are complete.
 */
export class StartPackageService implements StartPackageApplier
{
	private readonly stateStore: SubmissionStore;
	private readonly packageFactory: StartPackageFactory;
	private readonly emailRenderer: EmailRenderer;
	private readonly artifactWriter: ArtifactWriter;

	/**
	 * Creates Stage 6 orchestration from state, generation, rendering, and file
	 * boundaries so each behavior remains independently testable.
	 *
	 * @param stateStore The canonical submission correlation store.
	 * @param packageFactory The deterministic contributor-value factory.
	 * @param emailRenderer The complete MIME email presentation boundary.
	 * @param artifactWriter The local private artifact storage boundary.
	 */
	public constructor(stateStore: SubmissionStore, packageFactory: StartPackageFactory, emailRenderer: EmailRenderer, artifactWriter: ArtifactWriter)
	{
		this.stateStore = stateStore;
		this.packageFactory = packageFactory;
		this.emailRenderer = emailRenderer;
		this.artifactWriter = artifactWriter;
	}

	/**
	 * Requires established Azure DevOps correlation, creates the email artifact,
	 * and saves the deterministic branch exactly once after successful writing.
	 *
	 * @param submission The normalized contributor submission.
	 * @param azureDevOpsConfig The validated tracking destination.
	 * @param startConfig The validated email delivery configuration.
	 * @returns The deterministic local artifact path.
	 */
	public async Apply(submission: Submission, azureDevOpsConfig: AzureDevOpsConfig, startConfig: StartConfig): Promise<string>
	{
		const state: SubmissionState | undefined = await this.stateStore.Load(submission.submissionId);

		if (state === undefined)
		{
			throw new Error("Submission " + submission.submissionId + " must have Azure DevOps correlation before package generation.");
		}

		if (state.azureDevOpsId === undefined)
		{
			throw new Error("Submission " + submission.submissionId + " must have Azure DevOps correlation before package generation.");
		}

		this.Validate(state, submission);
		const startPackage: StartPackage = this.packageFactory.Create(submission, azureDevOpsConfig, state.azureDevOpsId);
		const emailContent: string = this.emailRenderer.Render(submission, startPackage, startConfig);
		const artifactPath: string = path.join(startConfig.outputDirectory, submission.submissionId + "-start-work.eml");
		await this.artifactWriter.Write(artifactPath, emailContent);
		const actionKey: string = "github:create-start-package";
		const actionComplete: boolean = state.completedActions.includes(actionKey);
		const branchComplete: boolean = state.branchName === startPackage.branchName;

		if (!actionComplete || !branchComplete)
		{
			state.branchName = startPackage.branchName;

			if (!actionComplete)
			{
				state.completedActions.push(actionKey);
			}

			await this.stateStore.Save(state, state.revision);
		}

		return artifactPath;
	}

	/**
	 * Protects durable repository, article, and branch identity before package
	 * values are reused or state is changed.
	 *
	 * @param state The loaded canonical state record.
	 * @param submission The current normalized submission.
	 */
	private Validate(state: SubmissionState, submission: Submission): void
	{
		const expectedBranch: string = "contrib/" + submission.submissionId;
		const ownerMatches: boolean = state.repository.owner === submission.repository.owner;
		const repositoryMatches: boolean = state.repository.name === submission.repository.name;
		const articleMatches: boolean = state.articlePath === submission.articlePath;
		const branchMatches: boolean = state.branchName === undefined || state.branchName === expectedBranch;

		if (!ownerMatches || !repositoryMatches || !articleMatches || !branchMatches)
		{
			throw new StateCorrelationError(submission.submissionId);
		}
	}
}