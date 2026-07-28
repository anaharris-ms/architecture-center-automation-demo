/**
 * Represents the current people responsible for the four human-controlled
 * review and publishing stages. Microsoft email is the durable identity because
 * it can also resolve the assignee for later Teams notifications.
 */
export interface ReviewAssignments
{
	/** The Microsoft email of the person assigned to technical review. */
	technicalReviewer: string;

	/** The Microsoft email of the person assigned to content review. */
	contentReviewer: string;

	/** The Microsoft email of the person assigned to editorial review. */
	editorialReviewer: string;

	/** The Microsoft email of the person assigned to publishing. */
	publisher: string;
}