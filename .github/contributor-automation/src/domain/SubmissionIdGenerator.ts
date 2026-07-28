/**
 * Generates stable, human-readable submission identifiers from intake sequence
 * numbers. The prefix is injected so hackathon behavior remains configuration
 * rather than a permanent assumption embedded in downstream services.
 */
export class SubmissionIdGenerator
{
	private readonly prefix: string;

	/**
	 * Creates a generator for one configured submission namespace. The prefix is
	 * normalized to uppercase and rejected when empty so generated identifiers
	 * remain consistent across workflow reruns.
	 *
	 * @param prefix The configured identifier prefix, such as `HACK`.
	 */
	public constructor(prefix: string)
	{
		const normalizedPrefix: string = prefix.trim().toUpperCase();

		if (normalizedPrefix.length === 0)
		{
			throw new Error("Submission ID prefix must not be empty.");
		}

		this.prefix = normalizedPrefix;
	}

	/**
	 * Creates a deterministic identifier from a positive integer. Values below
	 * four digits are padded for readability, while larger values remain intact
	 * so the namespace can grow without changing existing identifiers.
	 *
	 * @param submissionNumber The positive intake sequence to encode.
	 * @returns A stable identifier such as `HACK-0001`.
	 */
	public Create(submissionNumber: number): string
	{
		if (!Number.isSafeInteger(submissionNumber) || submissionNumber < 1)
		{
			throw new Error("Submission number must be a positive safe integer.");
		}

		const numberText: string = submissionNumber.toString();
		const paddedNumber: string = numberText.padStart(4, "0");
		const submissionId: string = this.prefix + "-" + paddedNumber;

		return submissionId;
	}
}