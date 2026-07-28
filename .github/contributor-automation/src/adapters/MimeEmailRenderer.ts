import fs from "node:fs";
import type { StartConfig } from "../domain/StartConfig.js";
import type { StartPackage } from "../domain/StartPackage.js";
import type { Submission } from "../domain/Submission.js";
import type { EmailRenderer } from "../ports/EmailRenderer.js";

/**
 * Renders an Outlook-compatible multipart email with inline Microsoft images.
 * The adapter owns HTML escaping, MIME transfer encoding, and filesystem asset
 * reads while deliberately performing no delivery or canonical-state changes.
 */
export class MimeEmailRenderer implements EmailRenderer
{
	/**
	 * Builds a complete multipart/related email whose HTML references embedded
	 * banner and footer images by content ID for offline Outlook rendering.
	 *
	 * @param submission The validated contributor submission.
	 * @param startPackage The deterministic Stage 6 instruction values.
	 * @param config The validated sender, guidance, asset, and output settings.
	 * @returns The complete MIME email document with CRLF line endings.
	 */
	public Render(submission: Submission, startPackage: StartPackage, config: StartConfig): string
	{
		const boundary: string = "----pnp-" + submission.submissionId;
		const bannerBytes: Buffer = fs.readFileSync(config.bannerPath);
		const footerBytes: Buffer = fs.readFileSync(config.footerPath);
		const html: string = this.BuildHtml(submission, startPackage, config);
		const lines: string[] = [];
		lines.push("From: " + this.FormatAddress(config.senderName, config.senderAddress));
		lines.push("To: " + this.FormatAddress(submission.contributor.name, submission.contributor.email));
		lines.push("Subject: " + this.EncodeHeader(config.subject));
		lines.push("MIME-Version: 1.0");
		lines.push("Content-Type: multipart/related; boundary=\"" + boundary + "\"");
		lines.push("");
		lines.push("--" + boundary);
		lines.push("Content-Type: text/html; charset=UTF-8");
		lines.push("Content-Transfer-Encoding: base64");
		lines.push("");
		lines.push(this.WrapBase64(Buffer.from(html, "utf8").toString("base64")));
		this.AddImage(lines, boundary, "learn-banner", bannerBytes, "microsoft-learn-header.png");
		this.AddImage(lines, boundary, "microsoft-footer", footerBytes, "microsoft-footer.png");
		lines.push("--" + boundary + "--");
		lines.push("");

		return lines.join("\r\n");
	}

	/**
	 * Builds the fixed-width table layout and contributor-specific content used
	 * by Outlook. Acknowledgment and access guidance intentionally precede the
	 * generated start-work instructions to match the approved visual flow.
	 *
	 * @param submission The validated submission supplying personal content.
	 * @param startPackage The generated repository and tracking instructions.
	 * @param config The configured guidance destinations.
	 * @returns A complete escaped HTML email document.
	 */
	private BuildHtml(submission: Submission, startPackage: StartPackage, config: StartConfig): string
	{
		const contributorName: string = this.EscapeHtml(submission.contributor.name);
		const proposalTitle: string = this.EscapeHtml(submission.proposal.title);
		const proposalSummary: string = this.EscapeHtml(submission.proposal.summary);
		const workItemUrl: string = this.EscapeHtml(startPackage.workItemUrl);
		const idWebUrl: string = this.EscapeHtml(config.idWebUrl);
		const accessHelpUrl: string = this.EscapeHtml(config.accessHelpUrl);
		const contributionOptionsUrl: string = this.EscapeHtml(config.contributionOptionsUrl);
		const webEditorUrl: string = this.EscapeHtml(startPackage.webEditorUrl);
		const repositoryUrl: string = this.EscapeHtml(startPackage.repositoryUrl);
		const branchName: string = this.EscapeHtml(startPackage.branchName);
		const articlePath: string = this.EscapeHtml(startPackage.articlePath);
		const pullRequestTitle: string = this.EscapeHtml(startPackage.pullRequestTitle);
		const htmlLines: string[] = [];
		htmlLines.push("<!doctype html>");
		htmlLines.push("<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"></head>");
		htmlLines.push("<body style=\"margin:0;padding:0;background:#f3f3f3;font-family:Segoe UI,Arial,sans-serif;color:#242424;\">");
		htmlLines.push("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f3f3f3;\"><tr><td align=\"center\" style=\"padding:24px 12px;\">");
		htmlLines.push("<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;\">");
		htmlLines.push("<tr><td><img src=\"cid:learn-banner\" alt=\"Microsoft Learn\" width=\"600\" style=\"display:block;width:100%;height:auto;border:0;\"></td></tr>");
		htmlLines.push("<tr><td style=\"box-sizing:border-box;padding:32px 42px 18px 42px;font-size:16px;line-height:1.55;\">");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">Hi " + contributorName + ",</p>");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">Thank you for submitting your contribution proposal to the Azure Architecture Center. We appreciate your interest in helping improve Microsoft Learn.</p>");
		htmlLines.push("<p style=\"margin:0 0 8px 0;\"><strong>" + proposalTitle + "</strong></p>");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">" + proposalSummary + "</p>");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">Your proposal has been added to our backlog. You can view the tracking item at <a href=\"" + workItemUrl + "\" style=\"color:#0067b8;\">" + this.EscapeHtml(startPackage.submissionId) + "</a>.</p>");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">Before you begin, confirm that you can sign in through <a href=\"" + idWebUrl + "\" style=\"color:#0067b8;\">IDWEB</a>. See <a href=\"" + accessHelpUrl + "\" style=\"color:#0067b8;\">request-access help</a> if needed, or review the <a href=\"" + contributionOptionsUrl + "\" style=\"color:#0067b8;\">latest contribution options</a>.</p>");
		htmlLines.push("<h2 style=\"margin:30px 0 14px 0;font-size:22px;line-height:1.25;font-weight:600;\">Start your contribution</h2>");
		htmlLines.push("<p style=\"margin:0 0 14px 0;\">Choose either GitHub in your browser or VS Code. Use the exact branch, article path, and pull-request title below so your work remains connected to this proposal.</p>");
		htmlLines.push("<h3 style=\"margin:24px 0 10px 0;font-size:17px;font-weight:600;\">GitHub web editor</h3>");
		htmlLines.push("<p style=\"margin:0 0 10px 0;\"><a href=\"" + webEditorUrl + "\" style=\"display:inline-block;background:#0067b8;color:#ffffff;text-decoration:none;padding:10px 18px;\">Open in github.dev</a></p>");
		htmlLines.push("<p style=\"margin:0 0 20px 0;\">This link opens the existing branch <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + branchName + "</code> at <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + articlePath + "</code>.</p>");
		htmlLines.push("<h3 style=\"margin:24px 0 10px 0;font-size:17px;font-weight:600;\">VS Code</h3>");
		htmlLines.push("<ol style=\"margin:0 0 20px 22px;padding:0;\"><li style=\"margin-bottom:8px;\">Clone <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + repositoryUrl + "</code>.</li><li style=\"margin-bottom:8px;\">Switch to the existing branch <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + branchName + "</code>.</li><li style=\"margin-bottom:8px;\">Edit <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + articlePath + "</code>.</li><li style=\"margin-bottom:8px;\">Commit and push your changes to the same branch.</li><li>Open a pull request titled <code style=\"font-family:Consolas,monospace;overflow-wrap:anywhere;\">" + pullRequestTitle + "</code>.</li></ol>");
		htmlLines.push("<p style=\"margin:28px 0 0 0;\">Thank you,<br>Patterns &amp; Practices Content Team</p>");
		htmlLines.push("</td></tr>");
		htmlLines.push("<tr><td style=\"border-top:1px solid #e1e1e1;\"><img src=\"cid:microsoft-footer\" alt=\"Microsoft\" width=\"600\" style=\"display:block;width:100%;height:auto;border:0;\"></td></tr>");
		htmlLines.push("</table></td></tr></table></body></html>");

		return htmlLines.join("");
	}

	/**
	 * Adds one base64 PNG body part with a content ID referenced by the HTML.
	 *
	 * @param lines The MIME document lines being accumulated.
	 * @param boundary The deterministic multipart boundary.
	 * @param contentId The HTML content ID for the image.
	 * @param imageBytes The exact PNG bytes read from the repository asset.
	 * @param fileName The attachment filename shown by mail clients.
	 */
	private AddImage(lines: string[], boundary: string, contentId: string, imageBytes: Buffer, fileName: string): void
	{
		lines.push("--" + boundary);
		lines.push("Content-Type: image/png; name=\"" + fileName + "\"");
		lines.push("Content-Transfer-Encoding: base64");
		lines.push("Content-ID: <" + contentId + ">");
		lines.push("Content-Disposition: inline; filename=\"" + fileName + "\"");
		lines.push("");
		lines.push(this.WrapBase64(imageBytes.toString("base64")));
	}

	/**
	 * Encodes a display name and combines it with a validated email address.
	 *
	 * @param displayName The human-readable mailbox name.
	 * @param emailAddress The validated mailbox address.
	 * @returns A MIME-safe mailbox header value.
	 */
	private FormatAddress(displayName: string, emailAddress: string): string
	{
		const formattedAddress: string = this.EncodeHeader(displayName) + " <" + emailAddress + ">";

		return formattedAddress;
	}

	/**
	 * Encodes arbitrary UTF-8 header text using the MIME encoded-word form.
	 *
	 * @param value The untrusted display text to encode.
	 * @returns A MIME-safe UTF-8 base64 encoded word.
	 */
	private EncodeHeader(value: string): string
	{
		const encodedValue: string = Buffer.from(value, "utf8").toString("base64");
		const headerValue: string = "=?UTF-8?B?" + encodedValue + "?=";

		return headerValue;
	}

	/**
	 * Wraps transfer-encoded data at the conventional 76-character MIME width.
	 *
	 * @param value The continuous base64 text to wrap.
	 * @returns Base64 text separated by CRLF without changing its bytes.
	 */
	private WrapBase64(value: string): string
	{
		const chunks: string[] = [];

		for (let index: number = 0; index < value.length; index += 76)
		{
			const chunk: string = value.substring(index, index + 76);
			chunks.push(chunk);
		}

		return chunks.join("\r\n");
	}

	/**
	 * Escapes text and URL attribute values before inserting them into HTML.
	 *
	 * @param value The validated but potentially markup-bearing input value.
	 * @returns Text with HTML-significant characters represented as entities.
	 */
	private EscapeHtml(value: string): string
	{
		let escapedValue: string = value.replaceAll("&", "&amp;");
		escapedValue = escapedValue.replaceAll("<", "&lt;");
		escapedValue = escapedValue.replaceAll(">", "&gt;");
		escapedValue = escapedValue.replaceAll("\"", "&quot;");
		escapedValue = escapedValue.replaceAll("'", "&#39;");

		return escapedValue;
	}
}