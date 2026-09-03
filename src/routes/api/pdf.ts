import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/lib/auth";

const MAX_BODY = 2_000_000; // ~2MB of markup+CSS is plenty for one A4 sheet

/**
 * Renders preview markup to an A4 PDF. Chromium can't run inside a Worker, so the
 * render is offloaded to the EC2 PDF service (Playwright), same shim pattern as
 * portfolio hosting / job-match. This route stays the session gate + validator and
 * forwards the payload; the browser never touches the EC2 URL directly.
 *
 * Degrades to 503 when PDF_RENDER_URL / PDF_RENDER_TOKEN are unset.
 */
export const Route = createFileRoute("/api/pdf")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session) return new Response("Unauthorized", { status: 401 });

				const url = process.env.PDF_RENDER_URL;
				const token = process.env.PDF_RENDER_TOKEN;
				if (!url || !token)
					return new Response("PDF rendering not configured", { status: 503 });

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

				const res = await fetch(`${url.replace(/\/$/, "")}/render`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ content, styles }),
				});
				if (!res.ok)
					return new Response(`PDF render failed: ${res.status}`, {
						status: 502,
					});

				return new Response(res.body, {
					headers: {
						"Content-Type": "application/pdf",
						"Content-Disposition": 'attachment; filename="resume.pdf"',
					},
				});
			},
		},
	},
});
