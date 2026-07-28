/**
 * Contains one secret Power Automate cloud-flow endpoint used by an external
 * operation boundary. The endpoint is supplied only at runtime and must never
 * be written to state, logs, output, artifacts, or repository configuration.
 */
export interface PowerAutomateConfig
{
	/** The HTTPS request endpoint generated for the Power Automate cloud flow. */
	endpointUrl: string;
}