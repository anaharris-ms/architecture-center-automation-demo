/**
 * Identifies the supported intake approval behavior without coupling planner
 * rules to the text representation used by a YAML file or future intake form.
 */
export enum ApprovalMode
{
	Preapproved = "preapproved",
	ApprovalRequired = "approval-required"
}