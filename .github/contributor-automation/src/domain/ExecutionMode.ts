/**
 * Identifies whether the pipeline should preview proposed actions or execute
 * them. Keeping the mode in the domain vocabulary gives every later command a
 * consistent safety boundary without depending on command-line strings.
 */
export enum ExecutionMode
{
	Plan = "plan",
	Apply = "apply"
}