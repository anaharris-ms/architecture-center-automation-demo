/**
 * Represents one Azure DevOps JSON Patch add operation. The contract is kept in
 * the adapter layer so REST paths do not leak into application or domain models.
 */
export interface JsonPatchOperation
{
	/** The JSON Patch operation supported by work-item creation. */
	op: "add";

	/** The Azure DevOps field or relation path receiving the value. */
	path: string;

	/** The field value or work-item relation object being added. */
	value: unknown;
}