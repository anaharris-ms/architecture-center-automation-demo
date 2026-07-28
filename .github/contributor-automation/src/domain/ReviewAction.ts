/**
 * Identifies the explicit GitHub action that caused one durable review-stage
 * transition. Values describe business evidence rather than workflow names so
 * the history remains stable if event routing changes later.
 */
export enum ReviewAction
{
	PullRequestOpened = "pull-request-opened",
	Approved = "approved",
	ChangesRequested = "changes-requested",
	RevisionSubmitted = "revision-submitted",
	TechnicalReopened = "technical-reopened",
	ContentReopened = "content-reopened",
	Merged = "merged"
}