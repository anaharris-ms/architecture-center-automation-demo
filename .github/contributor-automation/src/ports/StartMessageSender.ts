import type { StartMessage } from "../domain/StartMessage.js";

/**
 * Defines delivery of one normalized start message after contributor branch
 * preparation. Implementations own external transport while application code
 * owns correlation, ordering, and idempotent completion state.
 */
export interface StartMessageSender
{
	/**
	 * Sends one complete request and resolves only after the external boundary
	 * reports that its Teams post action succeeded.
	 *
	 * @param message The normalized private start-message content to deliver.
	 */
	Send(message: StartMessage): Promise<void>;
}