/**
 * Classifies deterministic pull-request correlation without treating missing
 * or conflicting evidence as an arbitrary submission match.
 */
export enum PullRequestOutcome
{
	Matched = "matched",
	Unmatched = "unmatched",
	Ambiguous = "ambiguous"
}