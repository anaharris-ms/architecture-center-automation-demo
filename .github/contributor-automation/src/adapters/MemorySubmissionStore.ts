import { StateConflictError } from "../application/StateConflictError.js";
import type { ReminderRecord } from "../domain/ReminderRecord.js";
import type { ReviewTransition } from "../domain/ReviewTransition.js";
import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import type { SubmissionState } from "../domain/SubmissionState.js";
import type { SubmissionStore } from "../ports/SubmissionStore.js";

/**
 * Stores canonical submission state in process memory for focused unit tests.
 * All reads and writes use detached copies so test code exercises the same
 * explicit save behavior required by durable adapters.
 */
export class MemorySubmissionStore implements SubmissionStore
{
	private readonly states: Map<string, SubmissionState>;

	/**
	 * Creates an empty deterministic state store for one test process.
	 */
	public constructor()
	{
		this.states = new Map<string, SubmissionState>();
	}

	/**
	 * Loads one detached state record by its stable submission identity.
	 *
	 * @param submissionId The stable identity to load.
	 * @returns A detached state record, or undefined when none exists.
	 */
	public async Load(submissionId: string): Promise<SubmissionState | undefined>
	{
		const storedState: SubmissionState | undefined = this.states.get(submissionId);
		let result: SubmissionState | undefined = undefined;

		if (storedState !== undefined)
		{
			result = this.Clone(storedState);
		}

		return Promise.resolve(result);
	}

	/**
	 * Creates or updates state only when the caller's expected revision matches
	 * the current stored revision, then returns a detached incremented record.
	 *
	 * @param state The complete canonical state to save.
	 * @param expectedRevision The revision observed before this save.
	 * @returns The detached saved state with its assigned revision.
	 */
	public async Save(state: SubmissionState, expectedRevision: number | undefined): Promise<SubmissionState>
	{
		const storedState: SubmissionState | undefined = this.states.get(state.submissionId);
		let storedRevision: number | undefined = undefined;

		if (storedState !== undefined)
		{
			storedRevision = storedState.revision;
		}

		if (storedRevision !== expectedRevision)
		{
			throw new StateConflictError(state.submissionId);
		}

		const savedState: SubmissionState = this.Clone(state);
		savedState.revision = expectedRevision === undefined ? 1 : expectedRevision + 1;
		this.states.set(savedState.submissionId, this.Clone(savedState));

		return Promise.resolve(this.Clone(savedState));
	}

	/**
	 * Finds detached records matching every defined query value and returns them
	 * in stable submission-ID order for deterministic workflow behavior.
	 *
	 * @param query The correlation criteria to apply.
	 * @returns All matching detached state records.
	 */
	public async Find(query: SubmissionQuery): Promise<SubmissionState[]>
	{
		const matches: SubmissionState[] = [];
		const states: SubmissionState[] = Array.from(this.states.values());

		for (const state of states)
		{
			if (this.Matches(state, query))
			{
				matches.push(this.Clone(state));
			}
		}

		matches.sort(this.Compare.bind(this));

		return Promise.resolve(matches);
	}

	/**
	 * Determines whether one stored record matches every query field that the
	 * caller supplied.
	 *
	 * @param state The canonical state being considered.
	 * @param query The correlation criteria supplied by the caller.
	 * @returns True when all defined criteria match the state.
	 */
	private Matches(state: SubmissionState, query: SubmissionQuery): boolean
	{
		const submissionMatches: boolean = query.submissionId === undefined || state.submissionId === query.submissionId;
		const githubUserMatches: boolean = query.githubUserId === undefined || state.githubUserId === query.githubUserId;
		const ownerMatches: boolean = query.repositoryOwner === undefined || state.repository.owner === query.repositoryOwner;
		const repositoryMatches: boolean = query.repositoryName === undefined || state.repository.name === query.repositoryName;
		const branchMatches: boolean = query.branchName === undefined || state.branchName === query.branchName;
		const articleMatches: boolean = query.articlePath === undefined || state.articlePath === query.articlePath;
		const pullRequestMatches: boolean = query.pullRequestNumber === undefined || state.pullRequestNumber === query.pullRequestNumber;
		const azureDevOpsMatches: boolean = query.azureDevOpsId === undefined || state.azureDevOpsId === query.azureDevOpsId;
		const matches: boolean = submissionMatches && githubUserMatches && ownerMatches && repositoryMatches && branchMatches && articleMatches && pullRequestMatches && azureDevOpsMatches;

		return matches;
	}

	/**
	 * Creates a detached state copy including nested collections and repository
	 * identity so callers cannot mutate stored state without an explicit save.
	 *
	 * @param state The canonical state to copy.
	 * @returns A fully detached state record.
	 */
	private Clone(state: SubmissionState): SubmissionState
	{
		const reminderHistory: ReminderRecord[] = [];

		for (const reminder of state.reminderHistory)
		{
			const reminderCopy: ReminderRecord =
				{
					reminderKey: reminder.reminderKey,
					recordedAt: reminder.recordedAt
				};
			reminderHistory.push(reminderCopy);
		}

		const reviewHistory: ReviewTransition[] = [];

		for (const transition of state.reviewState.history)
		{
			const transitionCopy: ReviewTransition =
				{
					eventId: transition.eventId,
					action: transition.action,
					fromStage: transition.fromStage,
					toStage: transition.toStage,
					githubActor: transition.githubActor,
					commitSha: transition.commitSha,
					recordedAt: transition.recordedAt
				};
			reviewHistory.push(transitionCopy);
		}

		const stateCopy: SubmissionState =
			{
				submissionId: state.submissionId,
				azureDevOpsId: state.azureDevOpsId,
				githubUserId: state.githubUserId,
				repository:
					{
						owner: state.repository.owner,
						name: state.repository.name
					},
				branchName: state.branchName,
				initialCommitSha: state.initialCommitSha,
				articlePath: state.articlePath,
				pullRequestNumber: state.pullRequestNumber,
				currentStage: state.currentStage,
				reviewState:
					{
						resumeStage: state.reviewState.resumeStage,
						openedCommitSha: state.reviewState.openedCommitSha,
						history: reviewHistory
					},
				assignments:
					{
						technicalReviewer: state.assignments.technicalReviewer,
						contentReviewer: state.assignments.contentReviewer,
						editorialReviewer: state.assignments.editorialReviewer,
						publisher: state.assignments.publisher
					},
				completedActions: [...state.completedActions],
				reminderHistory: reminderHistory,
				revision: state.revision
			};

		return stateCopy;
	}

	/**
	 * Compares two records by stable submission identity for deterministic query
	 * results.
	 *
	 * @param first The first state record.
	 * @param second The second state record.
	 * @returns Standard lexical comparison output.
	 */
	private Compare(first: SubmissionState, second: SubmissionState): number
	{
		const comparison: number = first.submissionId.localeCompare(second.submissionId);

		return comparison;
	}
}