import type { JsonObject } from "../contracts/JsonObject.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import { ReviewAction } from "../domain/ReviewAction.js";
import type { ReviewEvent } from "../domain/ReviewEvent.js";

/**
 * Converts a trusted GitHub Actions event document into the small review-event
 * contract owned by the application. Contributor-authored text is ignored;
 * only GitHub repository, PR, review, label, actor, SHA, and time facts are read.
 */
export class GitHubReviewEventParser
{
	/**
	 * Parses one GitHub Actions event and returns no command for event variants or
	 * labels unrelated to pipeline review progression.
	 *
	 * @param eventName The GitHub Actions event name.
	 * @param eventId The stable workflow run identity used for deduplication.
	 * @param eventText The trusted event JSON document from GITHUB_EVENT_PATH.
	 * @param repository The allowlisted base repository expected by the workflow.
	 * @param pullRequestNumber The expected positive pull-request number.
	 * @returns A validated review event, or undefined for an irrelevant action.
	 */
	public Parse(
		eventName: string,
		eventId: string,
		eventText: string,
		repository: RepositoryTarget,
		pullRequestNumber: number): ReviewEvent | undefined
	{
		const payloadValue: unknown = JSON.parse(eventText);
		const payload: JsonObject = this.ReadObject(payloadValue, "event");
		const actionName: string = this.ReadString(payload["action"], "event.action");
		const reviewAction: ReviewAction | undefined = this.GetAction(eventName, actionName, payload);
		let reviewEvent: ReviewEvent | undefined = undefined;

		if (reviewAction !== undefined)
		{
			const payloadRepository: JsonObject = this.ReadObject(payload["repository"], "event.repository");
			const fullName: string = this.ReadString(payloadRepository["full_name"], "event.repository.full_name");
			const expectedName: string = repository.owner + "/" + repository.name;
			const pullRequest: JsonObject = this.ReadObject(payload["pull_request"], "event.pull_request");
			const responseNumber: number = this.ReadNumber(pullRequest["number"], "event.pull_request.number");

			if (fullName !== expectedName || responseNumber !== pullRequestNumber)
			{
				throw new Error("GitHub review event does not match the expected pull request.");
			}

			const head: JsonObject = this.ReadObject(pullRequest["head"], "event.pull_request.head");
			const sender: JsonObject = this.ReadObject(payload["sender"], "event.sender");
			const recordedAt: string = this.GetRecordedAt(reviewAction, payload, pullRequest);
			reviewEvent =
				{
					eventId: eventId,
					action: reviewAction,
					repository: repository,
					pullRequestNumber: pullRequestNumber,
					githubActor: this.ReadString(sender["login"], "event.sender.login"),
					commitSha: this.ReadSha(head["sha"], "event.pull_request.head.sha"),
					recordedAt: recordedAt,
					maintainerAuthorized: false
				};
		}

		return reviewEvent;
	}

	/**
	 * Maps only supported formal review, push, reopen-label, and merge actions to
	 * domain values. Unrelated labels and event variants intentionally do nothing.
	 *
	 * @param eventName The GitHub Actions event name.
	 * @param actionName The event payload action value.
	 * @param payload The validated top-level event object.
	 * @returns The supported review action, or undefined when irrelevant.
	 */
	private GetAction(eventName: string, actionName: string, payload: JsonObject): ReviewAction | undefined
	{
		let reviewAction: ReviewAction | undefined = undefined;

		if (eventName === "pull_request_review" && actionName === "submitted")
		{
			const review: JsonObject = this.ReadObject(payload["review"], "event.review");
			const reviewState: string = this.ReadString(review["state"], "event.review.state").toLowerCase();

			if (reviewState === "approved")
			{
				reviewAction = ReviewAction.Approved;
			}
			else if (reviewState === "changes_requested")
			{
				reviewAction = ReviewAction.ChangesRequested;
			}
		}
		else if (eventName === "pull_request_target" && actionName === "synchronize")
		{
			reviewAction = ReviewAction.RevisionSubmitted;
		}
		else if (eventName === "pull_request_target" && actionName === "labeled")
		{
			reviewAction = this.GetLabelAction(payload);
		}
		else if (eventName === "pull_request_target" && actionName === "closed")
		{
			const pullRequest: JsonObject = this.ReadObject(payload["pull_request"], "event.pull_request");

			if (pullRequest["merged"] === true)
			{
				reviewAction = ReviewAction.Merged;
			}
		}

		return reviewAction;
	}

	/**
	 * Maps the two explicit temporary GitHub labels used as maintainer commands.
	 *
	 * @param payload The top-level labeled pull-request event payload.
	 * @returns The matching reopen action, or undefined for another label.
	 */
	private GetLabelAction(payload: JsonObject): ReviewAction | undefined
	{
		const label: JsonObject = this.ReadObject(payload["label"], "event.label");
		const labelName: string = this.ReadString(label["name"], "event.label.name");
		let reviewAction: ReviewAction | undefined = undefined;

		if (labelName === "pnp:reopen-technical-review")
		{
			reviewAction = ReviewAction.TechnicalReopened;
		}
		else if (labelName === "pnp:reopen-content-review")
		{
			reviewAction = ReviewAction.ContentReopened;
		}

		return reviewAction;
	}

	/**
	 * Selects the authoritative event timestamp from the relevant GitHub object.
	 *
	 * @param action The mapped review action.
	 * @param payload The top-level event payload.
	 * @param pullRequest The nested pull-request object.
	 * @returns A validated ISO-compatible timestamp string.
	 */
	private GetRecordedAt(action: ReviewAction, payload: JsonObject, pullRequest: JsonObject): string
	{
		let recordedAt: string;

		if (action === ReviewAction.Approved || action === ReviewAction.ChangesRequested)
		{
			const review: JsonObject = this.ReadObject(payload["review"], "event.review");
			recordedAt = this.ReadDate(review["submitted_at"], "event.review.submitted_at");
		}
		else if (action === ReviewAction.Merged)
		{
			recordedAt = this.ReadDate(pullRequest["merged_at"], "event.pull_request.merged_at");
		}
		else
		{
			recordedAt = this.ReadDate(pullRequest["updated_at"], "event.pull_request.updated_at");
		}

		return recordedAt;
	}

	/**
	 * Requires a non-null JSON object before reading external event fields.
	 *
	 * @param input The unknown value expected to contain an object.
	 * @param fieldPath The event field path used in validation errors.
	 * @returns The validated JSON object.
	 */
	private ReadObject(input: unknown, fieldPath: string): JsonObject
	{
		if (typeof input !== "object" || input === null || Array.isArray(input))
		{
			throw new Error(fieldPath + " must be an object.");
		}

		return input as JsonObject;
	}

	/**
	 * Requires one nonempty external string.
	 *
	 * @param input The unknown value expected to contain a string.
	 * @param fieldPath The event field path used in validation errors.
	 * @returns The validated nonempty string.
	 */
	private ReadString(input: unknown, fieldPath: string): string
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			throw new Error(fieldPath + " must be a nonempty string.");
		}

		return input;
	}

	/**
	 * Requires one positive safe integer from an external GitHub payload.
	 *
	 * @param input The unknown numeric value.
	 * @param fieldPath The event field path used in validation errors.
	 * @returns The validated positive integer.
	 */
	private ReadNumber(input: unknown, fieldPath: string): number
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
		{
			throw new Error(fieldPath + " must be a positive safe integer.");
		}

		return input;
	}

	/**
	 * Requires and normalizes one full Git commit SHA.
	 *
	 * @param input The unknown SHA value.
	 * @param fieldPath The event field path used in validation errors.
	 * @returns The normalized lowercase SHA.
	 */
	private ReadSha(input: unknown, fieldPath: string): string
	{
		const commitSha: string = this.ReadString(input, fieldPath);

		if (!/^[0-9a-fA-F]{40}$/.test(commitSha))
		{
			throw new Error(fieldPath + " must be a full Git commit SHA.");
		}

		return commitSha.toLowerCase();
	}

	/**
	 * Requires one timestamp parseable by the JavaScript date contract.
	 *
	 * @param input The unknown date value.
	 * @param fieldPath The event field path used in validation errors.
	 * @returns The original validated timestamp string.
	 */
	private ReadDate(input: unknown, fieldPath: string): string
	{
		const recordedAt: string = this.ReadString(input, fieldPath);

		if (!Number.isFinite(Date.parse(recordedAt)))
		{
			throw new Error(fieldPath + " must be a valid date.");
		}

		return recordedAt;
	}
}