import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { sites } from "#/db/schema";
import { authMiddleware } from "#/lib/auth-middleware";
import {
	MAX_SITE_BYTES,
	MAX_SITE_FILES,
	safeRelPath,
	subdomainError,
} from "#/lib/sites-shared";

/**
 * Portfolio hosting — Pro only. Publishes static files to the EC2 publisher shim, which
 * writes them under /srv/sites/<subdomain>/ for Caddy to serve at <subdomain>.resmio.in.
 *
 * Server-fn-only exports (imported by the client route — client-bundle rule). Degrades to
 * `configured:false` when SITE_PUBLISH_URL / SITE_PUBLISH_TOKEN are unset, like billing/jobs.
 */

type FileInput = { path: string; data: string };

const baseDomain = () => process.env.SITE_BASE_DOMAIN ?? "resmio.in";

function shimEnv(): { url: string; token: string } | null {
	const url = process.env.SITE_PUBLISH_URL;
	const token = process.env.SITE_PUBLISH_TOKEN;
	return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** List the caller's sites, newest first. */
export const listSites = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const rows = await db
			.select()
			.from(sites)
			.where(eq(sites.userId, context.user.id))
			.orderBy(desc(sites.createdAt));
		return rows.map((r) => ({
			id: r.id,
			subdomain: r.subdomain,
			title: r.title,
			status: r.status,
			sizeBytes: r.sizeBytes,
			fileCount: r.fileCount,
			url: `https://${r.subdomain}.${baseDomain()}`,
			updatedAt: r.updatedAt.getTime(),
		}));
	});

/** Is a subdomain usable by the caller? (Format/reserved + not taken by someone else.) */
export const checkSubdomain = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { subdomain?: string }) => ({
		subdomain: String(input.subdomain ?? "")
			.trim()
			.toLowerCase()
			.slice(0, 63),
	}))
	.handler(async ({ context, data }) => {
		const err = subdomainError(data.subdomain);
		if (err) return { available: false as const, error: err };
		const [taken] = await db
			.select({ userId: sites.userId })
			.from(sites)
			.where(eq(sites.subdomain, data.subdomain));
		if (taken && taken.userId !== context.user.id)
			return { available: false as const, error: "That subdomain is taken." };
		return { available: true as const, error: null };
	});

/** Publish (or re-publish) a static portfolio to <subdomain>.resmio.in. Pro only. */
export const publishSite = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		(input: { subdomain?: string; title?: string; files?: FileInput[] }) => ({
			subdomain: String(input.subdomain ?? "")
				.trim()
				.toLowerCase()
				.slice(0, 63),
			title: String(input.title ?? "").slice(0, 120),
			files: Array.isArray(input.files)
				? input.files.slice(0, MAX_SITE_FILES + 1)
				: [],
		}),
	)
	.handler(async ({ context, data }) => {
		const { isProUser } = await import("#/lib/entitlements");
		if (!(await isProUser(context.user.id)))
			throw new Error(
				"Portfolio hosting is a Pro feature — upgrade to unlock it.",
			);

		const err = subdomainError(data.subdomain);
		if (err) throw new Error(err);

		// Ownership: a subdomain owned by someone else can't be overwritten.
		const [existing] = await db
			.select()
			.from(sites)
			.where(eq(sites.subdomain, data.subdomain));
		if (existing && existing.userId !== context.user.id)
			throw new Error("That subdomain is taken.");

		// Validate + measure files (mirror publisher.py; defence in depth).
		const clean: FileInput[] = [];
		let total = 0;
		for (const f of data.files) {
			const rel = safeRelPath(String(f?.path ?? ""));
			if (!rel) throw new Error(`Unsupported file: ${f?.path}`);
			const bytes = Buffer.from(String(f?.data ?? ""), "base64");
			total += bytes.length;
			clean.push({ path: rel, data: bytes.toString("base64") });
		}
		if (clean.length === 0) throw new Error("Add at least one file.");
		if (clean.length > MAX_SITE_FILES)
			throw new Error(`Too many files (max ${MAX_SITE_FILES}).`);
		if (total > MAX_SITE_BYTES) throw new Error("Site exceeds 20 MB.");
		if (!clean.some((f) => f.path === "index.html"))
			throw new Error("An index.html file is required.");

		const shim = shimEnv();
		if (!shim) return { configured: false as const };

		const res = await fetch(`${shim.url}/publish`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${shim.token}`,
			},
			body: JSON.stringify({
				project: data.subdomain,
				title: data.title,
				files: clean,
			}),
			signal: AbortSignal.timeout(30_000),
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => "");
			throw new Error(`Publish failed (${res.status}). ${msg}`.trim());
		}

		const now = new Date();
		if (existing) {
			await db
				.update(sites)
				.set({
					title: data.title,
					sizeBytes: total,
					fileCount: clean.length,
					status: "live",
					updatedAt: now,
				})
				.where(eq(sites.id, existing.id));
		} else {
			try {
				await db.insert(sites).values({
					id: crypto.randomUUID(),
					userId: context.user.id,
					subdomain: data.subdomain,
					title: data.title,
					sizeBytes: total,
					fileCount: clean.length,
				});
			} catch {
				// Unique index on `subdomain` — someone claimed it between check and publish.
				throw new Error("That subdomain was just taken. Pick another.");
			}
		}
		return {
			configured: true as const,
			url: `https://${data.subdomain}.${baseDomain()}`,
		};
	});

/** Delete a site the caller owns: remove the files on EC2 and the DB row. */
export const deleteSite = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { id?: string }) => ({
		id: String(input.id ?? "").slice(0, 40),
	}))
	.handler(async ({ context, data }) => {
		const [row] = await db
			.select()
			.from(sites)
			.where(and(eq(sites.id, data.id), eq(sites.userId, context.user.id)));
		if (!row) throw new Error("Site not found.");

		const shim = shimEnv();
		if (shim) {
			// Best-effort remote delete; the DB row is the source of truth for the UI.
			await fetch(`${shim.url}/site/${row.subdomain}`, {
				method: "DELETE",
				headers: { authorization: `Bearer ${shim.token}` },
				signal: AbortSignal.timeout(15_000),
			}).catch(() => {});
		}
		await db.delete(sites).where(eq(sites.id, row.id));
		return { ok: true as const };
	});
