import { StateFormatError } from "./StateFormatError.js";
import type { JsonObject } from "../contracts/JsonObject.js";
import type { ReminderRecord } from "../domain/ReminderRecord.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import { ReviewAction } from "../domain/ReviewAction.js";
import type { ReviewAssignments } from "../domain/ReviewAssignments.js";
import type { ReviewState } from "../domain/ReviewState.js";
import type { ReviewTransition } from "../domain/ReviewTransition.js";
import { SubmissionStage } from "../domain/SubmissionStage.js";
import type { SubmissionState } from "../domain/SubmissionState.js";

/**
 * Converts canonical submission state between trusted domain records and JSON.
 * Decoding treats every persisted document as untrusted because state files can
 * be hand-edited or changed outside the workflow that originally wrote them.
 */
export class SubmissionStateCodec
{
	/**
	 * Serializes one state record using stable human-readable JSON formatting.
	 * Undefined external identifiers are omitted by standard JSON semantics.
	 *
	 * @param state The complete canonical state record to serialize.
	 * @returns The formatted JSON document with a trailing newline.
	 */
	public Encode(state: SubmissionState): string
	{
		const stateText: string = JSON.stringify(state, undefined, 2) + "\n";

		return stateText;
	}

	/**
	 * Parses and validates one persisted state document before constructing a
	 * trusted domain record with detached nested values and collections.
	 *
	 * @param stateText The untrusted JSON document to decode.
	 * @param sourceName The source description included in validation errors.
	 * @returns A complete validated canonical state record.
	 */
	public Decode(stateText: string, sourceName: string): SubmissionState
	{
		let parsedValue: unknown;

		try
		{
			parsedValue = JSON.parse(stateText);
		}
		catch
		{
			throw new StateFormatError(sourceName, "the document is not valid JSON.");
		}

		const stateObject: JsonObject = this.ReadObject(parsedValue, "state", sourceName);
		const allowedFields: string[] =
			[
				"submissionId",
				"azureDevOpsId",
				"githubUserId",
				"repository",
				"branchName",
				"initialCommitSha",
				"articlePath",
				"pullRequestNumber",
				"currentStage",
				"reviewState",
				"assignments",
				"completedActions",
				"reminderHistory",
				"revision"
			];
		this.CheckFields(stateObject, allowedFields, sourceName);
		const repository: RepositoryTarget = this.ReadRepository(stateObject["repository"], sourceName);
		const state: SubmissionState =
			{
				submissionId: this.ReadId(stateObject["submissionId"], sourceName),
				azureDevOpsId: this.ReadOptionalNumber(stateObject["azureDevOpsId"], "azureDevOpsId", sourceName),
				githubUserId: this.ReadOptionalNumber(stateObject["githubUserId"], "githubUserId", sourceName),
				repository: repository,
				branchName: this.ReadOptionalString(stateObject["branchName"], "branchName", sourceName),
				initialCommitSha: this.ReadOptionalSha(stateObject["initialCommitSha"], sourceName),
				articlePath: this.ReadString(stateObject["articlePath"], "articlePath", sourceName),
				pullRequestNumber: this.ReadOptionalNumber(stateObject["pullRequestNumber"], "pullRequestNumber", sourceName),
				currentStage: this.ReadStage(stateObject["currentStage"], sourceName),
				reviewState: this.ReadReview(stateObject["reviewState"], sourceName),
				assignments: this.ReadAssignments(stateObject["assignments"], sourceName),
				completedActions: this.ReadActions(stateObject["completedActions"], sourceName),
				reminderHistory: this.ReadReminders(stateObject["reminderHistory"], sourceName),
				revision: this.ReadRevision(stateObject["revision"], sourceName)
			};

		return state;
	}

	/**
	 * Creates a detached validated copy through the canonical JSON contract.
	 *
	 * @param state The trusted state record to copy.
	 * @returns A detached copy of the supplied record.
	 */
	public Clone(state: SubmissionState): SubmissionState
	{
		const stateText: string = this.Encode(state);
		const stateCopy: SubmissionState = this.Decode(stateText, state.submissionId);

		return stateCopy;
	}

	/**
	 * Rejects unknown state fields so persistence changes require corresponding
	 * model, documentation, migration, and test updates.
	 *
	 * @param input The state object whose property names are being checked.
	 * @param allowedFields The complete supported property list.
	 * @param sourceName The persistence source used in errors.
	 */
	private CheckFields(input: JsonObject, allowedFields: string[], sourceName: string): void
	{
		const actualFields: string[] = Object.keys(input);

		for (const actualField of actualFields)
		{
			if (!allowedFields.includes(actualField))
			{
				throw new StateFormatError(sourceName, actualField + " is not supported.");
			}
		}
	}

	/**
	 * Reads a non-null, non-array JSON object or reports its field path.
	 *
	 * @param input The unknown value expected to contain an object.
	 * @param fieldPath The human-readable contract field path.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated JSON object.
	 */
	private ReadObject(input: unknown, fieldPath: string, sourceName: string): JsonObject
	{
		if (typeof input !== "object" || input === null || Array.isArray(input))
		{
			throw new StateFormatError(sourceName, fieldPath + " must be an object.");
		}

		const value: JsonObject = input as JsonObject;

		return value;
	}

	/**
	 * Reads a required trimmed string and rejects empty values.
	 *
	 * @param input The unknown string value.
	 * @param fieldPath The human-readable contract field path.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated string without changing its content.
	 */
	private ReadString(input: unknown, fieldPath: string, sourceName: string): string
	{
		if (typeof input !== "string" || input.trim().length === 0)
		{
			throw new StateFormatError(sourceName, fieldPath + " must be a nonempty string.");
		}

		return input;
	}

	/**
	 * Reads a stable hackathon submission identity that is also safe for use as a
	 * state-document filename.
	 *
	 * @param input The unknown submission identity value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated stable submission identity.
	 */
	private ReadId(input: unknown, sourceName: string): string
	{
		const submissionId: string = this.ReadString(input, "submissionId", sourceName);
		const idPattern: RegExp = /^HACK-[0-9]{4,}$/;

		if (!idPattern.test(submissionId))
		{
			throw new StateFormatError(sourceName, "submissionId must use the HACK-0001 format.");
		}

		return submissionId;
	}

	/**
	 * Reads a positive safe integer when an external identifier is present.
	 *
	 * @param input The unknown optional numeric value.
	 * @param fieldPath The human-readable contract field path.
	 * @param sourceName The persistence source used in errors.
	 * @returns The positive integer, or undefined when no value was persisted.
	 */
	private ReadOptionalNumber(input: unknown, fieldPath: string, sourceName: string): number | undefined
	{
		let value: number | undefined = undefined;

		if (input !== undefined)
		{
			if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1)
			{
				throw new StateFormatError(sourceName, fieldPath + " must be a positive safe integer.");
			}

			value = input;
		}

		return value;
	}

	/**
	 * Reads a nonempty optional string used for branch correlation.
	 *
	 * @param input The unknown optional string value.
	 * @param fieldPath The human-readable contract field path.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated string, or undefined when no value was persisted.
	 */
	private ReadOptionalString(input: unknown, fieldPath: string, sourceName: string): string | undefined
	{
		let value: string | undefined = undefined;

		if (input !== undefined)
		{
			value = this.ReadString(input, fieldPath, sourceName);
		}

		return value;
	}

	/**
	 * Reads an optional full Git commit SHA used to prove the exact base selected
	 * before contributor branch creation. Abbreviated or non-hex values cannot
	 * provide durable branch correlation and are rejected at the state boundary.
	 *
	 * @param input The unknown optional initial commit SHA value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The normalized lowercase SHA, or undefined when not yet selected.
	 */
	private ReadOptionalSha(input: unknown, sourceName: string): string | undefined
	{
		let value: string | undefined = undefined;

		if (input !== undefined)
		{
			const commitSha: string = this.ReadString(input, "initialCommitSha", sourceName);
			const shaPattern: RegExp = /^[0-9a-fA-F]{40}$/;

			if (!shaPattern.test(commitSha))
			{
				throw new StateFormatError(sourceName, "initialCommitSha must be a full Git commit SHA.");
			}

			value = commitSha.toLowerCase();
		}

		return value;
	}

	/**
	 * Reads the nested GitHub repository identity and rejects unknown fields.
	 *
	 * @param input The unknown repository value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated repository identity.
	 */
	private ReadRepository(input: unknown, sourceName: string): RepositoryTarget
	{
		const repositoryObject: JsonObject = this.ReadObject(input, "repository", sourceName);
		this.CheckFields(repositoryObject, ["owner", "name"], sourceName);
		const repository: RepositoryTarget =
			{
				owner: this.ReadString(repositoryObject["owner"], "repository.owner", sourceName),
				name: this.ReadString(repositoryObject["name"], "repository.name", sourceName)
			};

		return repository;
	}

	/**
	 * Reads a supported pipeline business stage from its persisted string value.
	 *
	 * @param input The unknown stage value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated submission stage.
	 */
	private ReadStage(input: unknown, sourceName: string): SubmissionStage
	{
		const stageValues: string[] = Object.values(SubmissionStage);

		if (typeof input !== "string" || !stageValues.includes(input))
		{
			throw new StateFormatError(sourceName, "currentStage is not supported.");
		}

		return input as SubmissionStage;
	}

	/**
	 * Reads durable review orchestration facts and validates every transition as
	 * detached audit evidence. Semantic transition legality remains owned by the
	 * review-stage service rather than the persistence boundary.
	 *
	 * @param input The unknown review-state object.
	 * @param sourceName The persistence source used in errors.
	 * @returns Detached validated review state.
	 */
	private ReadReview(input: unknown, sourceName: string): ReviewState
	{
		const reviewObject: JsonObject = this.ReadObject(input, "reviewState", sourceName);
		this.CheckFields(reviewObject, ["resumeStage", "openedCommitSha", "history"], sourceName);
		const historyValue: unknown = reviewObject["history"];

		if (!Array.isArray(historyValue))
		{
			throw new StateFormatError(sourceName, "reviewState.history must be an array.");
		}

		const history: ReviewTransition[] = [];

		for (const item of historyValue)
		{
			history.push(this.ReadTransition(item, sourceName));
		}

		const reviewState: ReviewState =
			{
				resumeStage: this.ReadResume(reviewObject["resumeStage"], sourceName),
				openedCommitSha: this.ReadReviewSha(reviewObject["openedCommitSha"], sourceName),
				history: history
			};

		return reviewState;
	}

	/**
	 * Reads an optional drafting destination and permits only contributor-facing
	 * technical or content review stages.
	 *
	 * @param input The unknown optional resume-stage value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated resume stage, or undefined when drafting is inactive.
	 */
	private ReadResume(input: unknown, sourceName: string): SubmissionStage | undefined
	{
		let resumeStage: SubmissionStage | undefined = undefined;

		if (input !== undefined)
		{
			if (input === "technical-review")
			{
				resumeStage = SubmissionStage.TechnicalReview;
			}
			else if (input === "content-review")
			{
				resumeStage = SubmissionStage.ContentReview;
			}
			else
			{
				throw new StateFormatError(sourceName, "reviewState.resumeStage is not supported.");
			}
		}

		return resumeStage;
	}

	/**
	 * Reads one append-only review transition with strict fields, enum values,
	 * timestamp, actor, event identity, and commit-SHA validation.
	 *
	 * @param input The unknown transition value.
	 * @param sourceName The persistence source used in errors.
	 * @returns A detached validated review transition.
	 */
	private ReadTransition(input: unknown, sourceName: string): ReviewTransition
	{
		const transitionObject: JsonObject = this.ReadObject(input, "reviewState.history item", sourceName);
		const transitionFields: string[] =
			["eventId", "action", "fromStage", "toStage", "githubActor", "commitSha", "recordedAt"];
		this.CheckFields(transitionObject, transitionFields, sourceName);
		const actionInput: unknown = transitionObject["action"];
		const actionValues: string[] = Object.values(ReviewAction);

		if (typeof actionInput !== "string" || !actionValues.includes(actionInput))
		{
			throw new StateFormatError(sourceName, "reviewState.history.action is not supported.");
		}

		const recordedAt: string = this.ReadString(
			transitionObject["recordedAt"],
			"reviewState.history.recordedAt",
			sourceName);

		if (!Number.isFinite(Date.parse(recordedAt)))
		{
			throw new StateFormatError(sourceName, "reviewState.history.recordedAt must be a valid date.");
		}

		const transition: ReviewTransition =
			{
				eventId: this.ReadString(transitionObject["eventId"], "reviewState.history.eventId", sourceName),
				action: actionInput as ReviewAction,
				fromStage: this.ReadStage(transitionObject["fromStage"], sourceName),
				toStage: this.ReadStage(transitionObject["toStage"], sourceName),
				githubActor: this.ReadString(transitionObject["githubActor"], "reviewState.history.githubActor", sourceName),
				commitSha: this.ReadRequiredSha(transitionObject["commitSha"], "reviewState.history.commitSha", sourceName),
				recordedAt: recordedAt
			};

		return transition;
	}

	/**
	 * Reads an optional full PR commit SHA without sharing the initial-commit
	 * field name in validation diagnostics.
	 *
	 * @param input The unknown optional review commit SHA.
	 * @param sourceName The persistence source used in errors.
	 * @returns The normalized SHA, or undefined when review has not opened.
	 */
	private ReadReviewSha(input: unknown, sourceName: string): string | undefined
	{
		let commitSha: string | undefined = undefined;

		if (input !== undefined)
		{
			commitSha = this.ReadRequiredSha(input, "reviewState.openedCommitSha", sourceName);
		}

		return commitSha;
	}

	/**
	 * Reads and normalizes one required full Git commit SHA for review evidence.
	 *
	 * @param input The unknown required SHA value.
	 * @param fieldPath The complete field path used in validation errors.
	 * @param sourceName The persistence source used in errors.
	 * @returns The normalized lowercase full SHA.
	 */
	private ReadRequiredSha(input: unknown, fieldPath: string, sourceName: string): string
	{
		const commitSha: string = this.ReadString(input, fieldPath, sourceName);
		const shaPattern: RegExp = /^[0-9a-fA-F]{40}$/;

		if (!shaPattern.test(commitSha))
		{
			throw new StateFormatError(sourceName, fieldPath + " must be a full Git commit SHA.");
		}

		return commitSha.toLowerCase();
	}

	/**
	 * Reads the four current Microsoft-email role assignments and rejects missing,
	 * additional, or non-Microsoft identities at the persistence boundary.
	 *
	 * @param input The unknown role-assignment object.
	 * @param sourceName The persistence source used in errors.
	 * @returns Detached validated current role assignments.
	 */
	private ReadAssignments(input: unknown, sourceName: string): ReviewAssignments
	{
		const assignmentObject: JsonObject = this.ReadObject(input, "assignments", sourceName);
		const assignmentFields: string[] =
			[
				"technicalReviewer",
				"contentReviewer",
				"editorialReviewer",
				"publisher"
			];
		this.CheckFields(assignmentObject, assignmentFields, sourceName);
		const assignments: ReviewAssignments =
			{
				technicalReviewer: this.ReadMicrosoftEmail(
					assignmentObject["technicalReviewer"],
					"assignments.technicalReviewer",
					sourceName),
				contentReviewer: this.ReadMicrosoftEmail(
					assignmentObject["contentReviewer"],
					"assignments.contentReviewer",
					sourceName),
				editorialReviewer: this.ReadMicrosoftEmail(
					assignmentObject["editorialReviewer"],
					"assignments.editorialReviewer",
					sourceName),
				publisher: this.ReadMicrosoftEmail(
					assignmentObject["publisher"],
					"assignments.publisher",
					sourceName)
			};

		return assignments;
	}

	/**
	 * Reads one Microsoft email used to identify a current role assignee.
	 *
	 * @param input The unknown email value.
	 * @param fieldPath The complete assignment field path.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated Microsoft email without changing its casing.
	 */
	private ReadMicrosoftEmail(input: unknown, fieldPath: string, sourceName: string): string
	{
		const email: string = this.ReadString(input, fieldPath, sourceName);
		const emailPattern: RegExp = /^[^\s@]+@microsoft\.com$/i;

		if (!emailPattern.test(email))
		{
			throw new StateFormatError(sourceName, fieldPath + " must be a Microsoft email address.");
		}

		return email;
	}

	/**
	 * Reads unique, nonempty completed-action keys used for idempotent reruns.
	 *
	 * @param input The unknown completed-actions value.
	 * @param sourceName The persistence source used in errors.
	 * @returns A detached ordered collection of action keys.
	 */
	private ReadActions(input: unknown, sourceName: string): string[]
	{
		if (!Array.isArray(input))
		{
			throw new StateFormatError(sourceName, "completedActions must be an array.");
		}

		const actions: string[] = [];

		for (const item of input)
		{
			const action: string = this.ReadString(item, "completedActions item", sourceName);

			if (actions.includes(action))
			{
				throw new StateFormatError(sourceName, "completedActions must contain unique keys.");
			}

			actions.push(action);
		}

		return actions;
	}

	/**
	 * Reads reminder history entries used to deduplicate follow-up activity.
	 *
	 * @param input The unknown reminder-history value.
	 * @param sourceName The persistence source used in errors.
	 * @returns Detached validated reminder records.
	 */
	private ReadReminders(input: unknown, sourceName: string): ReminderRecord[]
	{
		if (!Array.isArray(input))
		{
			throw new StateFormatError(sourceName, "reminderHistory must be an array.");
		}

		const reminders: ReminderRecord[] = [];

		for (const item of input)
		{
			const reminderObject: JsonObject = this.ReadObject(item, "reminderHistory item", sourceName);
			this.CheckFields(reminderObject, ["reminderKey", "recordedAt"], sourceName);
			const recordedAt: string = this.ReadString(reminderObject["recordedAt"], "reminderHistory.recordedAt", sourceName);
			const recordedTime: number = Date.parse(recordedAt);

			if (!Number.isFinite(recordedTime))
			{
				throw new StateFormatError(sourceName, "reminderHistory.recordedAt must be a valid date.");
			}

			const reminder: ReminderRecord =
				{
					reminderKey: this.ReadString(reminderObject["reminderKey"], "reminderHistory.reminderKey", sourceName),
					recordedAt: recordedAt
				};
			reminders.push(reminder);
		}

		return reminders;
	}

	/**
	 * Reads the nonnegative safe revision assigned by a state store.
	 *
	 * @param input The unknown revision value.
	 * @param sourceName The persistence source used in errors.
	 * @returns The validated numeric revision.
	 */
	private ReadRevision(input: unknown, sourceName: string): number
	{
		if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0)
		{
			throw new StateFormatError(sourceName, "revision must be a nonnegative safe integer.");
		}

		return input;
	}
}