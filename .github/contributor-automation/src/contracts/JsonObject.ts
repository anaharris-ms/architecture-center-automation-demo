/**
 * Represents an untrusted JSON object at an application boundary. Values remain
 * unknown until the submission validator confirms their type and meaning, so
 * external data cannot enter domain behavior through unchecked assertions.
 */
export interface JsonObject
{
	[propertyName: string]: unknown;
}