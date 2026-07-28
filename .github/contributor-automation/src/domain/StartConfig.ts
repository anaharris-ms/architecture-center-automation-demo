/**
 * Represents validated Stage 6 delivery and guidance settings. URLs remain
 * configurable because production destinations are not yet approved, while
 * sender identity, image assets, and artifact location stay reviewable.
 */
export interface StartConfig
{
	/** The human-readable sender shown by mail clients. */
	senderName: string;

	/** The mailbox represented in the generated From header. */
	senderAddress: string;

	/** The stable subject used by the start-work email artifact. */
	subject: string;

	/** The guidance URL for Microsoft identity access. */
	idWebUrl: string;

	/** The guidance URL for contributors who need access help. */
	accessHelpUrl: string;

	/** The guidance URL describing current contribution options. */
	contributionOptionsUrl: string;

	/** The repository-relative Microsoft Learn banner image path. */
	bannerPath: string;

	/** The repository-relative Microsoft footer image path. */
	footerPath: string;

	/** The local directory receiving generated private email artifacts. */
	outputDirectory: string;
}