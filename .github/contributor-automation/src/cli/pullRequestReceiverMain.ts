import fs from "node:fs";
import { ConsoleWriter } from "../adapters/ConsoleWriter.js";
import { GitHubContentClient } from "../adapters/GitHubContentClient.js";
import { GitHubPullRequestLoader } from "../adapters/GitHubPullRequestLoader.js";
import { GitHubReviewClient } from "../adapters/GitHubReviewClient.js";
import { GitHubReviewEventParser } from "../adapters/GitHubReviewEventParser.js";
import { GitHubSubmissionStore } from "../adapters/GitHubSubmissionStore.js";
import { PowerAutomateStageClient } from "../adapters/PowerAutomateStageClient.js";
import { PullRequestApplication } from "../application/PullRequestApplication.js";
import type { PullRequestReceiverCommand } from "../application/PullRequestReceiverCommand.js";
import { PullRequestService } from "../application/PullRequestService.js";
import { ReviewStageService } from "../application/ReviewStageService.js";
import { StageNotificationService } from "../application/StageNotificationService.js";
import { SubmissionStateCodec } from "../application/SubmissionStateCodec.js";
import type { GitHubAccessConfig } from "../contracts/GitHubAccessConfig.js";
import type { GitHubStateConfig } from "../contracts/GitHubStateConfig.js";
import type { PullRequestObservation } from "../domain/PullRequestObservation.js";
import type { PowerAutomateConfig } from "../contracts/PowerAutomateConfig.js";
import { ReviewAction } from "../domain/ReviewAction.js";
import type { ReviewEvent } from "../domain/ReviewEvent.js";
import type { ReviewTransition } from "../domain/ReviewTransition.js";
import type { OutputWriter } from "../ports/OutputWriter.js";
import type { PullRequestApplier } from "../ports/PullRequestApplier.js";
import type { StageMessageSender } from "../ports/StageMessageSender.js";
import type { StateContentClient } from "../ports/StateContentClient.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";
import { PullRequestReceiverParser } from "./PullRequestReceiverParser.js";
import type { PullRequestReceiverResult } from "./PullRequestReceiverResult.js";
import { PullRequestRuntime } from "./PullRequestRuntime.js";

const outputWriter: OutputWriter = new ConsoleWriter();
const commandParser: PullRequestReceiverParser = new PullRequestReceiverParser();
const commandArguments: string[] = process.argv.slice(2);
const commandResult: PullRequestReceiverResult = commandParser.Parse(commandArguments);
const runtime: PullRequestRuntime = new PullRequestRuntime(outputWriter);
let exitCode: number = 1;

if (commandResult.command !== undefined)
{
	try
	{
		const command: PullRequestReceiverCommand = commandResult.command;
		runtime.RequireRepository(command.repository);
		const eventConfig: GitHubAccessConfig =
			{
				token: runtime.ReadRequired("GITHUB_EVENT_TOKEN")
			};
		const stateConfig: GitHubStateConfig = runtime.GetStateConfig();
		const contentClient: StateContentClient = new GitHubContentClient(stateConfig);
		const stateStore: SubmissionStore = new GitHubSubmissionStore(contentClient, new SubmissionStateCodec(), "submissions");
		const eventAction: string = runtime.ReadRequired("GITHUB_EVENT_ACTION");

		if (eventAction === "opened")
		{
			const pullRequestLoader: GitHubPullRequestLoader = new GitHubPullRequestLoader(eventConfig);
			const pullRequestApplier: PullRequestApplier = new PullRequestService(stateStore);
			const application: PullRequestApplication = new PullRequestApplication(
				outputWriter,
				pullRequestApplier);
			const observation: PullRequestObservation = await pullRequestLoader.LoadPullRequest(
				command.repository,
				command.pullRequestNumber);
			exitCode = await application.RunObservation(observation);

			if (exitCode === 0)
			{
				const powerAutomateConfig: PowerAutomateConfig =
					{
						endpointUrl: runtime.ReadRequired("POWER_AUTOMATE_STAGE_URL")
					};
				const stageSender: StageMessageSender = new PowerAutomateStageClient(powerAutomateConfig);
				const notificationService: StageNotificationService = new StageNotificationService(
					stateStore,
					stageSender);
				await notificationService.AnnounceOpen(command.repository, command.pullRequestNumber);
			}
		}
		else
		{
			const eventName: string = runtime.ReadRequired("GITHUB_EVENT_NAME");
			const eventId: string = runtime.ReadRequired("GITHUB_RUN_ID");
			const eventPath: string = runtime.ReadRequired("GITHUB_EVENT_PATH");
			const eventText: string = fs.readFileSync(eventPath, "utf8");
			const eventParser: GitHubReviewEventParser = new GitHubReviewEventParser();
			const reviewEvent: ReviewEvent | undefined = eventParser.Parse(
				eventName,
				eventId,
				eventText,
				command.repository,
				command.pullRequestNumber);

			if (reviewEvent !== undefined)
			{
				const reviewClient: GitHubReviewClient = new GitHubReviewClient(eventConfig);
				const reopenAction: boolean = reviewEvent.action === ReviewAction.TechnicalReopened
					|| reviewEvent.action === ReviewAction.ContentReopened;

				if (reopenAction)
				{
					reviewEvent.maintainerAuthorized = await reviewClient.IsMaintainer(
						command.repository,
						reviewEvent.githubActor);
				}

				const reviewService: ReviewStageService = new ReviewStageService(stateStore);
				const transition: ReviewTransition = await reviewService.Apply(reviewEvent);
				const powerAutomateConfig: PowerAutomateConfig =
					{
						endpointUrl: runtime.ReadRequired("POWER_AUTOMATE_STAGE_URL")
					};
				const stageSender: StageMessageSender = new PowerAutomateStageClient(powerAutomateConfig);
				const notificationService: StageNotificationService = new StageNotificationService(
					stateStore,
					stageSender);
				await notificationService.Apply(command.repository, command.pullRequestNumber, transition);
				outputWriter.Write(JSON.stringify(transition));

				if (reviewEvent.action === ReviewAction.TechnicalReopened)
				{
					await reviewClient.RemoveLabel(
						command.repository,
						command.pullRequestNumber,
						"pnp:reopen-technical-review");
				}
				else if (reviewEvent.action === ReviewAction.ContentReopened)
				{
					await reviewClient.RemoveLabel(
						command.repository,
						command.pullRequestNumber,
						"pnp:reopen-content-review");
				}
			}

			exitCode = 0;
		}
	}
	catch (error: unknown)
	{
		runtime.WriteFailure(error);
	}
}
else if (commandResult.errorMessage !== undefined)
{
	outputWriter.Write(commandResult.errorMessage);
}

process.exitCode = exitCode;