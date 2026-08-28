const INVALID_FILE_NAME_CHAR = /[\\/:*?"<>|]/g;

/** Turns a resume title into a filesystem-safe file name. */
export function safeFileName(title: string) {
	return (
		title.trim().replace(INVALID_FILE_NAME_CHAR, "_").replace(/\s+/g, " ") ||
		"resume"
	);
}

/** Serializes every readable stylesheet on the page so the server render matches the preview. */
function collectStyles() {
	return Array.from(document.styleSheets)
		.map((sheet) => {
			try {
				return Array.from(sheet.cssRules)
					.map((rule) => rule.cssText)
					.join("\n");
			} catch {
				// Cross-origin sheet — unreadable, and none of ours are.
				return "";
			}
		})
		.join("\n");
}

/**
 * Sends the live preview markup + page CSS to /api/pdf and downloads the result.
 * The sheet is sent on its own, so `@media print` rules apply to a document that
 * contains nothing else — no visibility juggling needed.
 */
export async function exportResumeToPdf(elementId: string, title: string) {
	const sheet = document.getElementById(elementId);
	if (!sheet) throw new Error(`PDF element #${elementId} not found`);

	const response = await fetch("/api/pdf", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			content: sheet.outerHTML,
			styles: collectStyles(),
		}),
	});
	if (!response.ok)
		throw new Error(`PDF generation failed: ${response.status}`);

	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement("a");
	link.href = url;
	link.download = `${safeFileName(title)}.pdf`;
	link.click();
	URL.revokeObjectURL(url);
}
