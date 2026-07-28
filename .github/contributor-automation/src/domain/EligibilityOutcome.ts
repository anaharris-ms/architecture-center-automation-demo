/**
 * Defines every approved result of GitHub contributor eligibility checking.
 * Business denials remain distinct from technical verification failure so the
 * pipeline never interprets unavailable GitHub facts as insufficient access.
 */
export enum EligibilityOutcome
{
	Eligible = "eligible",
	UnknownUser = "unknown-user",
	InsufficientAccess = "insufficient-access",
	VerificationFailed = "verification-failed"
}
