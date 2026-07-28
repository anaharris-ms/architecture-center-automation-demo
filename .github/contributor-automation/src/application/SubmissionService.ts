import type { Submission } from "../domain/Submission.js";
import type { SubmissionLoader } from "../ports/SubmissionLoader.js";
import type { SubmissionSource } from "../ports/SubmissionSource.js";
import { SubmissionError } from "./SubmissionError.js";
import { SubmissionFactory } from "./SubmissionFactory.js";
import type { SubmissionResult } from "./SubmissionResult.js";
import { SubmissionValidator } from "./SubmissionValidator.js";

/**
 * Coordinates loading, validating, and normalizing a faux submission at the
 * application boundary. External source and domain construction concerns stay
 * injected and independently testable.
 */
export class SubmissionService implements SubmissionLoader
{
	private readonly submissionSource: SubmissionSource;
	private readonly submissionValidator: SubmissionValidator;
	private readonly submissionFactory: SubmissionFactory;

	/**
	 * Creates the boundary service from replaceable source, validator, and
	 * normalization collaborators.
	 *
	 * @param submissionSource The adapter that loads untrusted intake data.
	 * @param submissionValidator The validator that checks the external contract.
	 * @param submissionFactory The factory that creates pipeline-owned models.
	 */
	public constructor(
		submissionSource: SubmissionSource,
		submissionValidator: SubmissionValidator,
		submissionFactory: SubmissionFactory)
	{
		this.submissionSource = submissionSource;
		this.submissionValidator = submissionValidator;
		this.submissionFactory = submissionFactory;
	}

	/**
	 * Loads one faux intake record and returns a validated normalized submission.
	 * Invalid data is reported before an ID or downstream action can be created.
	 *
	 * @param sourcePath The JSON fixture path identifying the intake record.
	 * @returns The validated pipeline-owned submission.
	 */
	public Load(sourcePath: string): Submission
	{
		const rawInput: unknown = this.submissionSource.Load(sourcePath);
		const validationResult: SubmissionResult = this.submissionValidator.Validate(rawInput);

		if (validationResult.value === undefined)
		{
			throw new SubmissionError(validationResult.errors);
		}

		const submission: Submission = this.submissionFactory.Create(validationResult.value);

		return submission;
	}
}