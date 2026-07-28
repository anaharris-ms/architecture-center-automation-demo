/**
 * Reports the idempotent outcome of applying one Azure DevOps action plan. A
 * reused work item is successful but distinguishable from a newly created item.
 */
export interface WorkItemResult
{
	/** The Azure DevOps work-item identifier found or created. */
	workItemId: number;

	/** True only when this execution created the User Story. */
	created: boolean;

	/** The stable completed-action key associated with the result. */
	actionKey: string;
}