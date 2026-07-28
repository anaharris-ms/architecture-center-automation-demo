import type { FauxSubmissionData } from "../contracts/FauxSubmissionData.js";
import type { Contributor } from "../domain/Contributor.js";
import type { Proposal } from "../domain/Proposal.js";
import type { RepositoryTarget } from "../domain/RepositoryTarget.js";
import type { Submission } from "../domain/Submission.js";
import { SubmissionIdGenerator } from "../domain/SubmissionIdGenerator.js";
import { SubmissionType } from "../domain/SubmissionType.js";

/**
 * Converts a validated faux intake contract into the pipeline-owned submission
 * model. Mapping remains separate from validation so later intake adapters can
 * reuse the same domain contract without inheriting JSON-specific behavior.
 */
export class SubmissionFactory
{
	private readonly idGenerator: SubmissionIdGenerator;

	/**
	 * Creates the factory with the configured stable-ID generator.
	 *
	 * @param idGenerator The generator responsible for submission identity.
	 */
	public constructor(idGenerator: SubmissionIdGenerator)
	{
		this.idGenerator = idGenerator;
	}

	/**
	 * Creates one normalized submission from validated faux intake data. The
	 * method maps the external string category to a domain enum and copies nested
	 * values into repository-owned models.
	 *
	 * @param input The validated faux submission contract.
	 * @returns The normalized pipeline submission.
	 */
	public Create(input: FauxSubmissionData): Submission
	{
		let submissionType: SubmissionType = SubmissionType.NewContent;

		if (input.submissionType === "update")
		{
			submissionType = SubmissionType.Update;
		}

		const contributor: Contributor =
			{
				name: input.contributor.name,
				email: input.contributor.email,
				githubUsername: input.contributor.githubUsername
			};
		const repository: RepositoryTarget =
			{
				owner: input.repository.owner,
				name: input.repository.name
			};
		const proposal: Proposal =
			{
				title: input.proposal.title,
				summary: input.proposal.summary
			};
		const submissionId: string = this.idGenerator.Create(input.submissionNumber);
		const submission: Submission =
			{
				submissionId: submissionId,
				contributor: contributor,
				submissionType: submissionType,
				repository: repository,
				articlePath: input.articlePath,
				proposal: proposal
			};

		return submission;
	}
}