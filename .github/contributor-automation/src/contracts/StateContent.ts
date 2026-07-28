/**
 * Represents one text document read from a revision-aware content service. The
 * opaque revision is supplied on update so the service can reject stale writes.
 */
export interface StateContent
{
	/** The repository-relative path containing the document. */
	path: string;

	/** The UTF-8 document content after transport decoding. */
	content: string;

	/** The opaque content revision required for an update. */
	revision: string;
}