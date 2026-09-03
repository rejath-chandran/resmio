import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://cvatsfriendly.com";

export const Route = createFileRoute("/sitemap/xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(
					`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>${BASE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
	<url><loc>${BASE}/about</loc><priority>0.6</priority></url>
	<url><loc>${BASE}/contact</loc><priority>0.5</priority></url>
	<url><loc>${BASE}/privacy</loc><priority>0.3</priority></url>
	<url><loc>${BASE}/terms</loc><priority>0.3</priority></url>
</urlset>`,
					{ headers: { "Content-Type": "application/xml" } },
				),
		},
	},
});
