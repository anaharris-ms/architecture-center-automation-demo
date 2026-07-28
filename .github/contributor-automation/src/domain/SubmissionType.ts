/**
 * Identifies the two contributor submission categories accepted by the
 * hackathon pipeline. Intake rules use this normalized value without depending
 * on the wording or structure of an external form.
 */
export enum SubmissionType
{
	Update = "update",
	NewContent = "new-content"
}