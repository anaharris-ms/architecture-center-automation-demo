import type { OutputWriter } from "../ports/OutputWriter.js";
import type { ActionPlanner } from "../ports/ActionPlanner.js";
import { ExecutionMode } from "../domain/ExecutionMode.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import type { IntakeConfig } from "../domain/IntakeConfig.js";
import type { Submission } from "../domain/Submission.js";
import type { IntakeConfigLoader } from "../ports/IntakeConfigLoader.js";
import type { SubmissionLoader } from "../ports/SubmissionLoader.js";
import type { AzureDevOpsConfigLoader } from "../ports/AzureDevOpsConfigLoader.js";
import type { WorkItemApplier } from "../ports/WorkItemApplier.js";
import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { WorkItemResult } from "../domain/WorkItemResult.js";
import type { StartConfig } from "../domain/StartConfig.js";
import type { StartConfigLoader } from "../ports/StartConfigLoader.js";
import type { StartPackageApplier } from "../ports/StartPackageApplier.js";
import type { ContributorBranchPreparer } from "../ports/ContributorBranchPreparer.js";
import type { ContributorBranch } from "../domain/ContributorBranch.js";
import type { StartNotificationApplier } from "../ports/StartNotificationApplier.js";
import type { PipelineCommand } from "./PipelineCommand.js";

/**
 * Coordinates command-line execution for the contributor automation pipeline.
 * Stage 1 keeps this service deliberately small while establishing the object
 * boundary that later commands will use for submission orchestration.
 */
export class PipelineApplication
{
	private readonly outputWriter: OutputWriter;
	private readonly submissionLoader: SubmissionLoader;
	private readonly configLoader: IntakeConfigLoader;
	private readonly actionPlanner: ActionPlanner;
	private readonly azureDevOpsConfigLoader: AzureDevOpsConfigLoader | undefined;
	private readonly workItemApplier: WorkItemApplier | undefined;
	private readonly branchPreparer: ContributorBranchPreparer | undefined;
	private readonly startConfigLoader: StartConfigLoader | undefined;
	private readonly startPackageApplier: StartPackageApplier | undefined;
	private readonly notificationApplier: StartNotificationApplier | undefined;
	private readonly azureDevOpsConfigPath: string;
	private readonly startConfigPath: string;

	/**
	 * Creates the application with an injected output destination. Constructor
	 * injection keeps environment-specific output outside the application and
	 * permits deterministic tests without intercepting the process console.
	 *
	 * @param outputWriter The destination for application messages.
	 * @param submissionLoader The boundary that loads normalized submissions.
	 * @param configLoader The boundary that loads validated intake settings.
	 * @param actionPlanner The non-mutating intake classification boundary.
	 * @param azureDevOpsConfigLoader The apply-only destination config boundary.
	 * @param workItemApplier The apply-only state-aware mutation boundary.
	 * @param branchPreparer The apply-only contributor branch preparation boundary.
	 * @param startConfigLoader The apply-only email configuration boundary.
	 * @param startPackageApplier The apply-only artifact generation boundary.
	 * @param notificationApplier The apply-only Teams notification boundary.
	 * @param azureDevOpsConfigPath The repository-owned destination config path.
	 * @param startConfigPath The repository-owned Stage 6 config path.
	 */
	public constructor(
		outputWriter: OutputWriter,
		submissionLoader: SubmissionLoader,
		configLoader: IntakeConfigLoader,
		actionPlanner: ActionPlanner,
		azureDevOpsConfigLoader: AzureDevOpsConfigLoader | undefined,
		workItemApplier: WorkItemApplier | undefined,
		branchPreparer: ContributorBranchPreparer | undefined,
		startConfigLoader: StartConfigLoader | undefined,
		startPackageApplier: StartPackageApplier | undefined,
		notificationApplier: StartNotificationApplier | undefined,
		azureDevOpsConfigPath: string,
		startConfigPath: string)
	{
		this.outputWriter = outputWriter;
		this.submissionLoader = submissionLoader;
		this.configLoader = configLoader;
		this.actionPlanner = actionPlanner;
		this.azureDevOpsConfigLoader = azureDevOpsConfigLoader;
		this.workItemApplier = workItemApplier;
		this.branchPreparer = branchPreparer;
		this.startConfigLoader = startConfigLoader;
		this.startPackageApplier = startPackageApplier;
		this.notificationApplier = notificationApplier;
		this.azureDevOpsConfigPath = azureDevOpsConfigPath;
		this.startConfigPath = startConfigPath;
	}

	/**
	 * Runs a validated pipeline command through the selected execution mode.
	 * Stage 1 reports mode selection without external effects; later stages will
	 * create action plans and register idempotent apply handlers here.
	 *
	 * @param command The validated command supplied by the CLI adapter.
	 * @returns A process-compatible exit code where zero indicates success.
	 */
	public async Run(command: PipelineCommand): Promise<number>
	{
		let exitCode: number = 1;

		try
		{
			const submission: Submission = this.submissionLoader.Load(command.submissionPath);
			const config: IntakeConfig = this.configLoader.Load(command.configPath);
			const actionPlan: AzureDevOpsPlan = this.actionPlanner.Create(submission, config);
			const summary: string = "Submission " + submission.submissionId + " validated as " + submission.submissionType + ".";
			this.outputWriter.Write(summary);
			this.WritePlan(actionPlan);
			let modeMessage: string;

			if (command.mode === ExecutionMode.Plan)
			{
				modeMessage = "Plan mode selected. No external changes were made.";
			}
			else
			{
				if (this.azureDevOpsConfigLoader === undefined || this.workItemApplier === undefined || this.branchPreparer === undefined || this.startConfigLoader === undefined || this.startPackageApplier === undefined || this.notificationApplier === undefined)
				{
					throw new Error("Apply mode dependencies are not configured.");
				}

				const azureDevOpsConfig: AzureDevOpsConfig = this.azureDevOpsConfigLoader.Load(this.azureDevOpsConfigPath);
				const result: WorkItemResult = await this.workItemApplier.Apply(submission, actionPlan, azureDevOpsConfig);
				const outcome: string = result.created ? "created" : "reused";
				modeMessage = "Apply mode " + outcome + " Azure DevOps work item " + result.workItemId.toString() + ".";
				const branch: ContributorBranch = await this.branchPreparer.Prepare(submission);
				const branchOutcome: string = branch.created ? "created" : "reused";
				this.outputWriter.Write("Contributor branch " + branch.branchName + " " + branchOutcome + ".");
				const startConfig: StartConfig = this.startConfigLoader.Load(this.startConfigPath);
				const artifactPath: string = await this.startPackageApplier.Apply(submission, azureDevOpsConfig, startConfig);
				this.outputWriter.Write("Start-work email artifact generated at " + artifactPath + ".");
				await this.notificationApplier.Apply(submission, azureDevOpsConfig, startConfig);
				this.outputWriter.Write("Private Teams start message delivered.");
			}

			this.outputWriter.Write(modeMessage);
			exitCode = 0;
		}
		catch (error: unknown)
		{
			let errorMessage: string = "Pipeline failed with an unknown error.";

			if (error instanceof Error)
			{
				errorMessage = "Pipeline failed: " + error.message;
			}

			this.outputWriter.Write(errorMessage);
		}

		return exitCode;
	}

	/**
	 * Writes the validated Azure DevOps plan in stable workflow-readable lines.
	 * The output contains business values and an idempotency key but no REST
	 * payload or claim that an external mutation occurred.
	 *
	 * @param actionPlan The validated non-mutating User Story proposal.
	 */
	private WritePlan(actionPlan: AzureDevOpsPlan): void
	{
		const workItemMessage: string = "Azure DevOps plan: create " + actionPlan.workItemType + " for " + actionPlan.submissionId + ".";
		const estimateMessage: string = "Story points: " + actionPlan.storyPoints.toString() + ".";
		const approvalMessage: string = "Approval: " + actionPlan.approvalMode + " by " + actionPlan.approver + ".";
		const actionMessage: string = "Action key: " + actionPlan.actionKey + ".";
		this.outputWriter.Write(workItemMessage);
		this.outputWriter.Write(estimateMessage);
		this.outputWriter.Write(approvalMessage);
		this.outputWriter.Write(actionMessage);
	}
}