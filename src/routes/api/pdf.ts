import { createFileRoute } from "@tanstack/react-router";
import { chromium } from "playwright";

import { auth } from "#/lib/auth";

const MAX_BODY = 2_000_000; // ~2MB of markup+CSS is plenty for one A4 sheet

/**
 * Renders preview markup to an A4 PDF with headless Chromium.
 * Session-gated: it would otherwise be an open HTML renderer.
 * ponytail: launches a browser per request — pool or move to a worker if
 * export traffic grows past occasional clicks.
 */
export const Route = createFileRoute("/api/pdf")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session) return new Response("Unauthorized", { status: 401 });

				const raw = await request.text();
				if (raw.length > MAX_BODY)
					return new Response("Payload too large", { status: 413 });

				let content: unknown;
				let styles: unknown;
				try {
					({ content, styles } = JSON.parse(raw));
				} catch {
					return new Response("Invalid JSON", { status: 400 });
				}
				if (typeof content !== "string" || typeof styles !== "string")
					return new Response("content and styles must be strings", {
						status: 400,
					});

				const browser = await chromium.launch();
				try {
					const page = await browser.newPage();
					// Block all outbound requests: the markup is self-contained, and this
					// keeps user-supplied HTML from making the server fetch anything.
					await page.route("**/*", (route) => route.abort());
					await page.setContent(
						`<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${content}</body></html>`,
						{ waitUntil: "domcontentloaded" },
					);
					const pdf = await page.pdf({
						format: "A4",
						printBackground: true,
						margin: { top: "0", right: "0", bottom: "0", left: "0" },
					});
					return new Response(new Uint8Array(pdf), {
						headers: {
							"Content-Type": "application/pdf",
							"Content-Disposition": 'attachment; filename="resume.pdf"',
						},
					});
				} finally {
					await browser.close();
				}
			},
		},
	},
});
