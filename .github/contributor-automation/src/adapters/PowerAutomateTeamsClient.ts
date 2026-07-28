import type { PowerAutomateConfig } from "../contracts/PowerAutomateConfig.js";
import type { StartMessage } from "../domain/StartMessage.js";
import type { StartMessageSender } from "../ports/StartMessageSender.js";

/**
 * Sends normalized private start-message context to a Power Automate cloud flow
 * created in the Teams Workflows app. The cloud flow owns recipient resolution,
 * Flow bot presentation, and the Teams post action; this adapter accepts success
 * only when the endpoint returns a successful HTTP status.
 */
export class PowerAutomateTeamsClient implements StartMessageSender
{
	private readonly config: PowerAutomateConfig;

	/**
	 * Creates the HTTP adapter and validates that its secret endpoint uses HTTPS.
	 * The endpoint value is never included in an error or external payload.
	 *
	 * @param config The runtime Power Automate cloud-flow endpoint configuration.
	 */
	public constructor(config: PowerAutomateConfig)
	{
		this.ValidateEndpoint(config.endpointUrl);
		this.config = config;
	}

	/**
	 * Posts one JSON request to the Power Automate cloud flow. A non-successful
	 * response remains a delivery failure and its untrusted body is never logged
	 * or exposed through the sanitized error.
	 *
	 * @param message The normalized private Teams start-message content.
	 */
	public async Send(message: StartMessage): Promise<void>
	{
		const request: RequestInit =
			{
				method: "POST",
				headers:
					{
						"Content-Type": "application/json"
					},
				body: JSON.stringify(message)
			};
		let response: Response;

		try
		{
			response = await fetch(this.config.endpointUrl, request);
		}
		catch
		{
			throw new Error("Power Automate start-message request failed.");
		}

		if (!response.ok)
		{
			throw new Error("Power Automate start-message request failed with HTTP " + response.status.toString() + ".");
		}
	}

	/**
	 * Requires one absolute HTTPS endpoint without exposing its secret query
	 * parameters in diagnostics. Power Automate endpoint hostnames can vary by
	 * environment, so validation constrains the protocol rather than one host.
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
			throw new Error("Power Automate endpoint must be an absolute HTTPS URL.");
		}

		if (parsedUrl.protocol !== "https:")
		{
			throw new Error("Power Automate endpoint must be an absolute HTTPS URL.");
		}
	}
}