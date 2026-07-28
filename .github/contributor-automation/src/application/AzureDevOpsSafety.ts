import type { AzureDevOpsConfig } from "../domain/AzureDevOpsConfig.js";
import type { AzureDevOpsPlan } from "../domain/AzureDevOpsPlan.js";
import { AzureDevOpsSafetyError } from "./AzureDevOpsSafetyError.js";

/**
 * Enforces a fixed fail-closed hackathon write boundary independently from the
 * editable YAML configuration. This deliberate duplication prevents a config
 * edit from redirecting the PAT to another organization, project, or parent.
 */
export class AzureDevOpsSafety
{
	private readonly organization: string;
	private readonly project: string;
	private readonly parentId: number;
	private readonly allowedPrefix: string;

	/**
	 * Creates the immutable destination policy selected for the demonstration.
	 *
	 * @param organization The only Azure DevOps organization allowed to mutate.
	 * @param project The only Azure DevOps project allowed to mutate.
	 * @param parentId The only parent Feature allowed for generated stories.
	 * @param allowedPrefix The only stable submission prefix allowed to create.
	 */
	public constructor(organization: string, project: string, parentId: number, allowedPrefix: string)
	{
		this.organization = organization;
		this.project = project;
		this.parentId = parentId;
		this.allowedPrefix = allowedPrefix;
	}

	/**
	 * Validates destination settings and stable identity before any client call.
	 *
	 * @param actionPlan The validated Stage 4 action plan being applied.
	 * @param config The validated but editable destination configuration.
	 */
	public Validate(actionPlan: AzureDevOpsPlan, config: AzureDevOpsConfig): void
	{
		if (config.organization !== this.organization)
		{
			throw new AzureDevOpsSafetyError("organization must be " + this.organization + ".");
		}

		if (config.project !== this.project)
		{
			throw new AzureDevOpsSafetyError("project must be " + this.project + ".");
		}

		if (config.parentId !== this.parentId)
		{
			throw new AzureDevOpsSafetyError("parentId must be " + this.parentId.toString() + ".");
		}

		if (config.allowedPrefix !== this.allowedPrefix)
		{
			throw new AzureDevOpsSafetyError("allowedPrefix must be " + this.allowedPrefix + ".");
		}

		const submissionPattern: RegExp = new RegExp("^" + this.allowedPrefix + "-[0-9]{4,}$");

		if (!submissionPattern.test(actionPlan.submissionId))
		{
			throw new AzureDevOpsSafetyError("submissionId is outside the allowed prefix.");
		}
	}
}