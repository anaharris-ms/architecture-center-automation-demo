import type { StateContent } from "../contracts/StateContent.js";

/**
 * Defines revision-aware text document operations used by the durable state
 * store. The port keeps GitHub REST payloads outside canonical store behavior.
 */
export interface StateContentClient
{
	/**
	 * Reads one text document and its opaque service revision.
	 *
	 * @param contentPath The repository-relative document path.
	 * @returns The decoded document, or undefined when it does not exist.
	 */
	Read(contentPath: string): Promise<StateContent | undefined>;

	/**
	 * Lists text document paths directly beneath one repository directory.
	 *
	 * @param directoryPath The repository-relative directory path.
	 * @returns Stable repository-relative paths returned by the service.
	 */
	List(directoryPath: string): Promise<string[]>;

	/**
	 * Writes one text document using an opaque revision for update protection.
	 *
	 * @param contentPath The repository-relative document path.
	 * @param content The complete UTF-8 text document to persist.
	 * @param expectedRevision The service revision observed before the write.
	 * @param message The commit message describing the state change.
	 * @returns The newly persisted document and its new service revision.
	 */
	Write(contentPath: string, content: string, expectedRevision: string | undefined, message: string): Promise<StateContent>;
}