/**
 * Pure, client-safe helpers for portfolio hosting — no db/pg/server imports, so both the
 * client route and the server fn can share them (same split as jobs-rerank.ts). Mirrors the
 * guards in site-host/publisher.py; keep the two in sync.
 */

/** 3–63 chars, lowercase alnum + hyphen, no leading/trailing hyphen. */
export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

/** Names we never let a user take (app host, infra, brand). Matches publisher.py RESERVED. */
export const RESERVED_SUBDOMAINS = new Set([
	"app",
	"www",
	"api",
	"admin",
	"mail",
	"cdn",
	"static",
	"assets",
	"ftp",
	"ns1",
	"ns2",
	"smtp",
	"imap",
	"pop",
	"webmail",
	"dashboard",
	"billing",
	"status",
	"docs",
	"blog",
	"help",
	"support",
	"resmio",
]);

export const ALLOWED_EXT = new Set([
	".html",
	".htm",
	".css",
	".js",
	".mjs",
	".json",
	".svg",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".ico",
	".txt",
	".woff",
	".woff2",
	".map",
]);

export const MAX_SITE_BYTES = 20 * 1024 * 1024; // 20 MB (room for a real build + source maps)
export const MAX_SITE_FILES = 200;

/** Returns an error message when the subdomain is unusable, or null when it's fine. */
export function subdomainError(raw: string): string | null {
	const name = raw.trim().toLowerCase();
	if (!name) return "Enter a subdomain.";
	if (!SUBDOMAIN_RE.test(name))
		return "3–63 chars: lowercase letters, numbers and hyphens (not at the ends).";
	if (RESERVED_SUBDOMAINS.has(name)) return "That name is reserved.";
	return null;
}

/** Normalises a client file path to a safe site-relative path, or null if unsafe/disallowed. */
export function safeRelPath(path: string): string | null {
	const p = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	if (!p || p.startsWith(".") || p.split("/").includes("..")) return null;
	const dot = p.lastIndexOf(".");
	const ext = dot >= 0 ? p.slice(dot).toLowerCase() : "";
	if (!ALLOWED_EXT.has(ext)) return null;
	return p;
}

/**
 * When a whole folder is uploaded (e.g. a React/Vite `build/` or `dist/`), every path is
 * nested under that folder. Returns the prefix to strip so the folder's `index.html` becomes
 * the site root, or null if the files are already rooted (or no index.html is found).
 */
export function rootPrefix(paths: string[]): string | null {
	if (paths.includes("index.html")) return null;
	const nested = paths
		.filter((p) => p.endsWith("/index.html"))
		.sort((a, b) => a.length - b.length);
	if (nested.length === 0) return null;
	return nested[0].slice(0, -"index.html".length); // e.g. "build/"
}
