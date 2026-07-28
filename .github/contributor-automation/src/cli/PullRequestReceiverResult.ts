import type { PullRequestReceiverCommand } from "../application/PullRequestReceiverCommand.js";

/**
 * Carries either one validated trusted receiver command or one stable usage
 * error so malformed workflow inputs fail before credentials or APIs are used.
 */
export interface PullRequestReceiverResult
{
	/** The validated receiver command when every argument is accepted. */
	command: PullRequestReceiverCommand | undefined;
	/** The stable usage error when arguments are missing or malformed. */
	errorMessage: string | undefined;
}