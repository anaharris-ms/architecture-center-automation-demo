// Identifies the explicitly selected Azure DevOps adapter used by apply mode.
// Mock mode preserves the complete pipeline shape without network access to
// Azure DevOps, while Entra mode uses the production REST adapter and token.
export enum AzureDevOpsMode
{
	Mock = "mock",
	Entra = "entra"
}
