/**
 * Records one durable reminder outcome without retaining private message text
 * or a recipient address. The stable key prevents a later rerun from sending
 * the same logical reminder more than once.
 */
export interface ReminderRecord
{
	/** The stable idempotency key assigned to the reminder action. */
	reminderKey: string;

	/** The ISO 8601 time at which the reminder action was recorded. */
	recordedAt: string;
}