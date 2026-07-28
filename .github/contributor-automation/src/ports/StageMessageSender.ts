import type { StageMessage } from "../domain/StageMessage.js";

/**
 * Defines delivery of one normalized review-stage handoff announcement. The
 * implementation owns transport while application code owns correlation and
 * idempotent completion state.
 */
export interface StageMessageSender
{
	/**
	 * Sends one complete stage announcement and resolves only after the external
	 * group-chat boundary reports success.
	 *
	 * @param message The normalized stage handoff context to deliver.
	 */
	Send(message: StageMessage): Promise<void>;
}