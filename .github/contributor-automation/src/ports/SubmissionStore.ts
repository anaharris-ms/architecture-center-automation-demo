import type { SubmissionQuery } from "../domain/SubmissionQuery.js";
import type { SubmissionState } from "../domain/SubmissionState.js";

/**
 * Defines persistence operations for canonical contributor submission state.
 * Implementations may use memory, local files, Git, or a future database while
 * preserving the same load, save, query, and concurrency behavior.
 */
export interface SubmissionStore
{
	/**
	 * Loads one canonical state record by stable submission identity.
	 *
	 * @param submissionId The stable pipeline submission identity.
	 * @returns A detached state record, or undefined when none exists.
	 */
	Load(submissionId: string): Promise<SubmissionState | undefined>;

	/**
	 * Saves one state record when its expected revision still matches storage.
	 * Undefined creates a new record; a number updates an existing revision.
	 *
	 * @param state The complete canonical state to persist.
	 * @param expectedRevision The revision observed by the current operation.
	 * @returns The detached saved record with its newly assigned revision.
	 */
	Save(state: SubmissionState, expectedRevision: number | undefined): Promise<SubmissionState>;

	/**
	 * Finds records matching every defined correlation field in a query.
	 *
	 * @param query The repository-owned correlation criteria.
	 * @returns Detached matching records in stable submission-ID order.
	 */
	Find(query: SubmissionQuery): Promise<SubmissionState[]>;
}