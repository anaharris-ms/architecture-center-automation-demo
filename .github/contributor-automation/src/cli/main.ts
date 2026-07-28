import { ConsoleWriter } from "../adapters/ConsoleWriter.js";
import { FileArtifactWriter } from "../adapters/FileArtifactWriter.js";
import { EntraAzureDevOpsClient } from "../adapters/EntraAzureDevOpsClient.js";
import { GitHubContentClient } from "../adapters/GitHubContentClient.js";
import { MockAzureDevOpsClient } from "../adapters/MockAzureDevOpsClient.js";
import { GitHubContributorVerifier } from "../adapters/GitHubContributorVerifier.js";
import { GitHubBranchClient } from "../adapters/GitHubBranchClient.js";
import { GitHubSubmissionStore } from "../adapters/GitHubSubmissionStore.js";
import { PowerAutomateTeamsClient } from "../adapters/PowerAutomateTeamsClient.js";
import { JsonSubmissionSource } from "../adapters/JsonSubmissionSource.js";
import { MimeEmailRenderer } from "../adapters/MimeEmailRenderer.js";
import { YamlAzureDevOpsSource } from "../adapters/YamlAzureDevOpsSource.js";
import { YamlIntakeSource } from "../adapters/YamlIntakeSource.js";
import { YamlStartSource } from "../adapters/YamlStartSource.js";
import { AzureDevOpsConfigService } from "../application/AzureDevOpsConfigService.js";
import { AzureDevOpsSafety } from "../application/AzureDevOpsSafety.js";
import { AzureDevOpsService } from "../application/AzureDevOpsService.js";
import { AzureDevOpsStateService } from "../application/AzureDevOpsStateService.js";
import { IntakeConfigService } from "../application/IntakeConfigService.js";
import { ContributorAccessService } from "../application/ContributorAccessService.js";
import { ContributorBranchService } from "../application/ContributorBranchService.js";
import { IntakePlanner } from "../application/IntakePlanner.js";
import { PipelineApplication } from "../application/PipelineApplication.js";
import { StartConfigService } from "../application/StartConfigService.js";
import { StartPackageFactory } from "../application/StartPackageFactory.js";
import { StartPackageService } from "../application/StartPackageService.js";
import { StartMessageFactory } from "../application/StartMessageFactory.js";
import { StartNotificationService } from "../application/StartNotificationService.js";
import type { PipelineCommand } from "../application/PipelineCommand.js";
import { SubmissionFactory } from "../application/SubmissionFactory.js";
import { SubmissionService } from "../application/SubmissionService.js";
import { SubmissionValidator } from "../application/SubmissionValidator.js";
import { SubmissionIdGenerator } from "../domain/SubmissionIdGenerator.js";
import { AzureDevOpsMode } from "../domain/AzureDevOpsMode.js";
import { ExecutionMode } from "../domain/ExecutionMode.js";
import type { AzureDevOpsClient } from "../ports/AzureDevOpsClient.js";
import type { AzureDevOpsConfigLoader } from "../ports/AzureDevOpsConfigLoader.js";
import type { AzureDevOpsConfigSource } from "../ports/AzureDevOpsConfigSource.js";
import type { OutputWriter } from "../ports/OutputWriter.js";
import type { ActionPlanner } from "../ports/ActionPlanner.js";
import type { IntakeConfigLoader } from "../ports/IntakeConfigLoader.js";
import type { IntakeConfigSource } from "../ports/IntakeConfigSource.js";
import type { SubmissionLoader } from "../ports/SubmissionLoader.js";
import type { SubmissionSource } from "../ports/SubmissionSource.js";
import type { WorkItemApplier } from "../ports/WorkItemApplier.js";
import type { StartConfigLoader } from "../ports/StartConfigLoader.js";
import type { StartConfigSource } from "../ports/StartConfigSource.js";
import type { StartPackageApplier } from "../ports/StartPackageApplier.js";
import { SubmissionStateCodec } from "../application/SubmissionStateCodec.js";
import { SubmissionStateFactory } from "../application/SubmissionStateFactory.js";
import { WorkItemFactory } from "../application/WorkItemFactory.js";
import type { GitHubStateConfig } from "../contracts/GitHubStateConfig.js";
import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { PowerAutomateConfig } from "../contracts/PowerAutomateConfig.js";
import type { StateContentClient } from "../ports/StateContentClient.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import type { WorkItemExecutor } from "../ports/WorkItemExecutor.js";
import type { ContributorVerifier } from "../ports/ContributorVerifier.js";
import type { ContributorBranchClient } from "../ports/ContributorBranchClient.js";
import type { ContributorBranchPreparer } from "../ports/ContributorBranchPreparer.js";
import type { StartMessageSender } from "../ports/StartMessageSender.js";
import type { StartNotificationApplier } from "../ports/StartNotificationApplier.js";
import { CommandParser } from "./CommandParser.js";
import type { CommandResult } from "./CommandResult.js";

const outputWriter: OutputWriter = new ConsoleWriter();
const commandParser: CommandParser = new CommandParser();
const submissionSource: SubmissionSource = new JsonSubmissionSource();
const submissionValidator: SubmissionValidator = new SubmissionValidator();
const idGenerator: SubmissionIdGenerator = new SubmissionIdGenerator("HACK");
const submissionFactory: SubmissionFactory = new SubmissionFactory(idGenerator);
const submissionLoader: SubmissionLoader = new SubmissionService(
	submissionSource,
	submissionValidator,
	submissionFactory);
const configSource: IntakeConfigSource = new YamlIntakeSource();
const configLoader: IntakeConfigLoader = new IntakeConfigService(configSource);
const actionPlanner: ActionPlanner = new IntakePlanner();
const commandArguments: string[] = process.argv.slice(2);
const commandResult: CommandResult = commandParser.Parse(commandArguments);
let exitCode: number = 1;

if (commandResult.command !== undefined)
{
	try
	{
		const command: PipelineCommand = commandResult.command;
		const azureDevOpsConfigSource: AzureDevOpsConfigSource = new YamlAzureDevOpsSource();
		const azureDevOpsConfigLoader: AzureDevOpsConfigLoader = new AzureDevOpsConfigService(azureDevOpsConfigSource);
		const startConfigSource: StartConfigSource = new YamlStartSource();
		const startConfigLoader: StartConfigLoader = new StartConfigService(startConfigSource);
		let workItemApplier: WorkItemApplier | undefined = undefined;
		let branchPreparer: ContributorBranchPreparer | undefined = undefined;
		let startPackageApplier: StartPackageApplier | undefined = undefined;
		let notificationApplier: StartNotificationApplier | undefined = undefined;

		if (command.mode === ExecutionMode.Apply)
		{
			const gitHubConfig: GitHubStateConfig = GetStateConfig();
			const contentClient: StateContentClient = new GitHubContentClient(gitHubConfig);
			const stateStore: SubmissionStore = new GitHubSubmissionStore(contentClient, new SubmissionStateCodec(), "submissions");
			const defaultReviewerEmail: string = ReadRequired("DEFAULT_REVIEWER_EMAIL");
			const stateFactory: SubmissionStateFactory = new SubmissionStateFactory(defaultReviewerEmail);
			const gitHubAccessConfig: GitHubAccessConfig =
				{
					token: ReadRequired("GITHUB_REPOSITORY_TOKEN")
				};
			const contributorVerifier: ContributorVerifier = new GitHubContributorVerifier(gitHubAccessConfig);
			const accessService: ContributorAccessService = new ContributorAccessService(
				stateStore,
				stateFactory,
				contributorVerifier);
			const contributionBaseBranch: string = ReadRequired("GITHUB_CONTRIBUTION_BASE_BRANCH");
			const branchClient: ContributorBranchClient = new GitHubBranchClient(
				gitHubAccessConfig,
				contributionBaseBranch);
			branchPreparer = new ContributorBranchService(stateStore, accessService, branchClient);
			const azureDevOpsMode: AzureDevOpsMode = ReadAdoMode();
			let azureDevOpsClient: AzureDevOpsClient;

			if (azureDevOpsMode === AzureDevOpsMode.Mock)
			{
				azureDevOpsClient = new MockAzureDevOpsClient(
					contentClient,
					outputWriter,
					"mock-ado/work-items.json");
			}
			else
			{
				const azureDevOpsToken: string = ReadRequired("AZURE_DEVOPS_TOKEN");
				azureDevOpsClient = new EntraAzureDevOpsClient(azureDevOpsToken);
			}

			const safety: AzureDevOpsSafety = new AzureDevOpsSafety("msft-skilling", "Content", 599805, "HACK");
			const workItemExecutor: WorkItemExecutor = new AzureDevOpsService(azureDevOpsClient, safety, new WorkItemFactory());
			workItemApplier = new AzureDevOpsStateService(stateStore, stateFactory, workItemExecutor);
			startPackageApplier = new StartPackageService(stateStore, new StartPackageFactory(), new MimeEmailRenderer(), new FileArtifactWriter());
			const powerAutomateConfig: PowerAutomateConfig =
				{
					endpointUrl: ReadRequired("POWER_AUTOMATE_START_URL")
				};
			const messageSender: StartMessageSender = new PowerAutomateTeamsClient(powerAutomateConfig);
			notificationApplier = new StartNotificationService(
				stateStore,
				new StartPackageFactory(),
				new StartMessageFactory(),
				messageSender);
		}

		const application: PipelineApplication = new PipelineApplication(
			outputWriter,
			submissionLoader,
			configLoader,
			actionPlanner,
			azureDevOpsConfigLoader,
			workItemApplier,
			branchPreparer,
			startConfigLoader,
			startPackageApplier,
			notificationApplier,
			"config/azure-devops.yaml",
			"config/start-package.yaml");
		exitCode = await application.Run(command);
	}
	catch (error: unknown)
	{
		WriteFailure(error, outputWriter);
	}
}
else if (commandResult.errorMessage !== undefined)
{
	const errorMessage: string = commandResult.errorMessage;
	outputWriter.Write(errorMessage);
}

process.exitCode = exitCode;

/**
 * Reads one required nonempty runtime environment value without including its
 * contents in an error. This keeps PATs and GitHub tokens out of diagnostics.
 *
 * @param variableName The required environment variable name.
 * @returns The nonempty runtime value.
 */
function ReadRequired(variableName: string): string
{
	const value: string | undefined = process.env[variableName];

	if (value === undefined || value.trim().length === 0)
	{
		throw new Error(variableName + " must be configured for apply mode.");
	}

	return value;
}

/**
 * Reads the required Azure DevOps adapter mode used by apply composition. Only
 * the explicit `mock` and `entra` values are accepted so a misspelled or
 * missing setting cannot silently enable network access or simulated data.
 * Mock mode deliberately avoids reading an Azure DevOps token, while Entra
 * mode requires the production credential later during client construction.
 *
 * @returns The validated adapter mode selected for this apply execution.
 */
function ReadAdoMode(): AzureDevOpsMode
{
	const configuredMode: string = ReadRequired("AZURE_DEVOPS_MODE");
	let mode: AzureDevOpsMode;

	if (configuredMode === "mock")
	{
		mode = AzureDevOpsMode.Mock;
	}
	else if (configuredMode === "entra")
	{
		mode = AzureDevOpsMode.Entra;
	}
	else
	{
		throw new Error("AZURE_DEVOPS_MODE must be mock or entra.");
	}

	return mode;
}

/**
 * Builds canonical GitHub state configuration from GitHub Actions environment
 * values. A dedicated branch keeps state commits separate from source changes.
 *
 * @returns Validated GitHub repository, branch, and token configuration.
 */
function GetStateConfig(): GitHubStateConfig
{
	const repositoryValue: string = ReadRequired("GITHUB_REPOSITORY");
	const repositoryParts: string[] = repositoryValue.split("/");
	const owner: string | undefined = repositoryParts.at(0);
	const repository: string | undefined = repositoryParts.at(1);

	if (repositoryParts.length !== 2 || owner === undefined || owner.length === 0 || repository === undefined || repository.length === 0)
	{
		throw new Error("GITHUB_REPOSITORY must use owner/repository format.");
	}

	let branch: string = "submission-state";
	const configuredBranch: string | undefined = process.env["GITHUB_STATE_BRANCH"];

	if (configuredBranch !== undefined && configuredBranch.trim().length > 0)
	{
		branch = configuredBranch;
	}

	const config: GitHubStateConfig =
		{
			owner: owner,
			repository: repository,
			branch: branch,
			token: ReadRequired("GITHUB_TOKEN")
		};

	return config;
}

/**
 * Writes one sanitized composition failure without emitting a Node.js stack
 * trace or including runtime secret values. The CLI retains exit code one so
 * GitHub Actions records the apply operation as failed.
 *
 * @param error The unknown failure raised while constructing runtime adapters.
 * @param writer The operator-visible application output boundary.
 */
function WriteFailure(error: unknown, writer: OutputWriter): void
{
	let errorMessage: string = "Pipeline failed with an unknown error.";

	if (error instanceof Error)
	{
		errorMessage = "Pipeline failed: " + error.message;
	}

	writer.Write(errorMessage);
}