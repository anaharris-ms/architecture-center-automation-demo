/**
 * Identifies the pipeline-owned business stage recorded for one contributor
 * submission. Stage values describe durable business progress rather than a
 * particular GitHub workflow run or Azure DevOps process-state value.
 */
export enum SubmissionStage
{
	Intake = "intake",
	Planned = "planned",
	Drafting = "drafting",
	TechnicalReview = "technical-review",
	ContentReview = "content-review",
	EditorialReview = "editorial-review",
	Publishing = "publishing",
	Complete = "complete",
	Withdrawn = "withdrawn"
}