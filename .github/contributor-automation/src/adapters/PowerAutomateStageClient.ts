import type { PowerAutomateConfig } from "../contracts/PowerAutomateConfig.js";
import type { StageMessage } from "../domain/StageMessage.js";
import type { StageMessageSender } from "../ports/StageMessageSender.js";

/**
 * Sends normalized stage handoffs to a Power Automate flow configured to post
 * in the existing internal p&p group chat. The cloud flow owns presentation and
 * chat selection; this adapter requires only an HTTPS success response.
 */
export class PowerAutomateStageClient implements StageMessageSender
{
	private readonly config: PowerAutomateConfig;

	/**
	 * Creates the HTTP adapter after validating its secret HTTPS endpoint.
	 *
	 * @param config The stage-message cloud-flow endpoint configuration.
	 */
	public constructor(config: PowerAutomateConfig)
	{
		this.ValidateEndpoint(config.endpointUrl);
		this.config = config;
	}

	/**
	 * Posts one stage announcement without exposing the endpoint or untrusted
	 * response body in errors.
	 *
	 * @param message The normalized group-chat stage handoff.
	 */
	public async Send(message: StageMessage): Promise<void>
	{
		const request: RequestInit =
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(message)
			};
		let response: Response;

		try
		{
			response = await fetch(this.config.endpointUrl, request);
		}
		catch
		{
			throw new Error("Power Automate stage-message request failed.");
		}

		if (!response.ok)
		{
			throw new Error("Power Automate stage-message request failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Requires one absolute HTTPS endpoint while keeping its secret query values
	 * out of diagnostics.
	 *
	 * @param endpointUrl The runtime cloud-flow endpoint to validate.
	 */
	private ValidateEndpoint(endpointUrl: string): void
	{
		let parsedUrl: URL;

		try
		{
			parsedUrl = new URL(endpointUrl);
		}
		catch
		{
			throw new Error("Power Automate stage endpoint must be an absolute HTTPS URL.");
		}

		if (parsedUrl.protocol !== "https:")
		{
			throw new Error("Power Automate stage endpoint must be an absolute HTTPS URL.");
		}
	}
}