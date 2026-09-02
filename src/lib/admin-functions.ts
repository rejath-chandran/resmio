import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, gt, like, or, sql, sum } from "drizzle-orm";

import { isLayoutId } from "#/components/resume-preview/layouts";
import { db } from "#/db";
import {
	payments,
	plans,
	resumes,
	subscriptions,
	templates,
	user as userTable,
} from "#/db/schema";
import { adminMiddleware } from "#/lib/auth-middleware";
import { isSlug, parseTheme } from "#/lib/templates";

/**
 * Admin server functions. Every one is gated by adminMiddleware — the route
 * guard in src/routes/_admin.tsx only hides UI.
 *
 * Privacy boundary: admins see resume *metadata* (title, template, timestamps)
 * and can delete for abuse handling, never resume contents. Resumes hold names,
 * emails, phone numbers and employment history.
 */

const PAGE = 25;

const str = (v: unknown, max: number) =>
	typeof v === "string" ? v.trim().slice(0, max) : "";

export const adminStats = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const [[users], [resumeCount], [templateCount], [activeTemplates]] =
			await Promise.all([
				db.select({ n: count() }).from(userTable),
				db.select({ n: count() }).from(resumes),
				db.select({ n: count() }).from(templates),
				db
					.select({ n: count() })
					.from(templates)
					.where(eq(templates.isActive, true)),
			]);

		// Signups in the last 7 days, and the most-used templates.
		const weekAgo = new Date(Date.now() - 7 * 86_400_000);
		const [[newUsers], byTemplate, [activeSubs], [revenue]] = await Promise.all(
			[
				db
					.select({ n: count() })
					.from(userTable)
					.where(
						sql`${userTable.createdAt} >= ${Math.floor(weekAgo.getTime() / 1000)}`,
					),
				db
					.select({ template: resumes.template, n: count() })
					.from(resumes)
					.groupBy(resumes.template)
					.orderBy(desc(count())),
				db
					.select({ n: count() })
					.from(subscriptions)
					.where(
						and(
							eq(subscriptions.status, "active"),
							gt(subscriptions.currentPeriodEnd, new Date()),
						),
					),
				db
					.select({ total: sum(payments.amount).mapWith(Number) })
					.from(payments)
					.where(eq(payments.status, "paid")),
			],
		);

		return {
			users: users.n,
			newUsersThisWeek: newUsers.n,
			resumes: resumeCount.n,
			templates: templateCount.n,
			activeTemplates: activeTemplates.n,
			byTemplate: byTemplate.map((r) => ({ template: r.template, n: r.n })),
			activeSubscriptions: activeSubs.n,
			revenueInr: revenue.total ?? 0,
		};
	});

export const listUsers = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator((input?: { q?: string; page?: number }) => ({
		q: str(input?.q, 80),
		page: Math.max(0, Math.trunc(Number(input?.page) || 0)),
	}))
	.handler(async ({ data }) => {
		const term = `%${data.q}%`;
		const where = data.q
			? or(like(userTable.email, term), like(userTable.name, term))
			: undefined;

		const [rows, [total]] = await Promise.all([
			db
				.select({
					id: userTable.id,
					name: userTable.name,
					email: userTable.email,
					role: userTable.role,
					createdAt: userTable.createdAt,
					resumeCount: count(resumes.id),
				})
				.from(userTable)
				.leftJoin(resumes, eq(resumes.userId, userTable.id))
				.where(where)
				.groupBy(userTable.id)
				.orderBy(desc(userTable.createdAt))
				.limit(PAGE)
				.offset(data.page * PAGE),
			db.select({ n: count() }).from(userTable).where(where),
		]);

		return {
			users: rows.map((r) => ({
				id: r.id,
				name: r.name,
				email: r.email,
				role: r.role,
				createdAt: r.createdAt.getTime(),
				resumeCount: r.resumeCount,
			})),
			total: total.n,
			page: data.page,
			pageSize: PAGE,
		};
	});

/** Resume metadata for one user — deliberately never returns `resumes.data`. */
export const listUserResumes = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator((id: string) => str(id, 40))
	.handler(async ({ data: userId }) => {
		const rows = await db
			.select({
				id: resumes.id,
				title: resumes.title,
				template: resumes.template,
				updatedAt: resumes.updatedAt,
			})
			.from(resumes)
			.where(eq(resumes.userId, userId))
			.orderBy(desc(resumes.updatedAt));
		return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.getTime() }));
	});

export const setUserRole = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((input: { id: string; role: string }) => {
		if (input.role !== "user" && input.role !== "admin") {
			throw new Error("role must be 'user' or 'admin'");
		}
		return { id: str(input.id, 40), role: input.role };
	})
	.handler(async ({ data }) => {
		// Demoting the last admin would lock the environment out of the panel.
		if (data.role === "user") await assertNotLastAdmin(data.id);
		await db
			.update(userTable)
			.set({ role: data.role, updatedAt: new Date() })
			.where(eq(userTable.id, data.id));
		return { ok: true };
	});

export const deleteUser = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((id: string) => str(id, 40))
	.handler(async ({ context, data: id }) => {
		if (id === context.user.id) {
			throw new Error("Use account deletion to remove your own account");
		}
		await assertNotLastAdmin(id);
		// Resumes and sessions cascade via the FKs in schema.ts.
		await db.delete(userTable).where(eq(userTable.id, id));
		return { ok: true };
	});

async function assertNotLastAdmin(id: string) {
	const [target] = await db
		.select({ role: userTable.role })
		.from(userTable)
		.where(eq(userTable.id, id));
	if (target?.role !== "admin") return;
	const admins = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.role, "admin"));
	if (admins.length <= 1) throw new Error("Cannot remove the last admin");
}

export const adminDeleteResume = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((id: string) => str(id, 40))
	.handler(async ({ data: id }) => {
		await db.delete(resumes).where(eq(resumes.id, id));
		return { ok: true };
	});

/* ---------- Templates ---------- */

export const listAllTemplates = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const rows = await db
			.select({
				id: templates.id,
				name: templates.name,
				description: templates.description,
				layout: templates.layout,
				theme: templates.theme,
				isActive: templates.isActive,
				isPro: templates.isPro,
				sortOrder: templates.sortOrder,
				updatedAt: templates.updatedAt,
				usage: count(resumes.id),
			})
			.from(templates)
			.leftJoin(resumes, eq(resumes.template, templates.id))
			.groupBy(templates.id)
			.orderBy(asc(templates.sortOrder), asc(templates.name));
		return rows.map((r) => ({
			...r,
			theme: parseTheme(JSON.parse(r.theme)),
			updatedAt: r.updatedAt.getTime(),
		}));
	});

/** Shared shape for create/update. Throws on anything the DB shouldn't see. */
function validateTemplate(input: {
	id?: string;
	name?: string;
	description?: string;
	layout?: string;
	theme?: unknown;
	isActive?: boolean;
	isPro?: boolean;
	sortOrder?: number;
}) {
	const name = str(input.name, 60);
	if (!name) throw new Error("Name is required");
	if (!isLayoutId(input.layout)) throw new Error("Unknown layout");
	return {
		name,
		description: str(input.description, 200),
		layout: input.layout,
		theme: JSON.stringify(parseTheme(input.theme)),
		isActive: input.isActive !== false,
		isPro: input.isPro === true,
		sortOrder: Math.trunc(Number(input.sortOrder) || 0),
	};
}

export const createTemplate = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((input: Parameters<typeof validateTemplate>[0]) => {
		// Id doubles as a route param and as the stored value in resumes.template.
		if (!isSlug(input.id)) {
			throw new Error(
				"Id must be 2-40 chars: lowercase letters, digits, dashes",
			);
		}
		return { id: input.id, ...validateTemplate(input) };
	})
	.handler(async ({ data }) => {
		const [existing] = await db
			.select({ id: templates.id })
			.from(templates)
			.where(eq(templates.id, data.id));
		if (existing) throw new Error(`Template "${data.id}" already exists`);
		await db.insert(templates).values(data);
		return { id: data.id };
	});

export const updateTemplate = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((input: Parameters<typeof validateTemplate>[0]) => {
		if (!isSlug(input.id)) throw new Error("Invalid template id");
		return { id: input.id, ...validateTemplate(input) };
	})
	.handler(async ({ data }) => {
		const { id, ...set } = data;
		await db
			.update(templates)
			.set({ ...set, updatedAt: new Date() })
			.where(eq(templates.id, id));
		return { ok: true };
	});

export const setTemplateActive = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((input: { id: string; isActive: boolean }) => {
		if (!isSlug(input.id)) throw new Error("Invalid template id");
		return { id: input.id, isActive: input.isActive === true };
	})
	.handler(async ({ data }) => {
		await db
			.update(templates)
			.set({ isActive: data.isActive, updatedAt: new Date() })
			.where(eq(templates.id, data.id));
		return { ok: true };
	});

/**
 * Refused while any resume references the template — deleting it would leave
 * those resumes pointing at nothing. Deactivate instead: existing resumes keep
 * rendering, and it disappears from the picker.
 */
export const deleteTemplate = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((id: string) => str(id, 40))
	.handler(async ({ data: id }) => {
		const [{ n }] = await db
			.select({ n: count() })
			.from(resumes)
			.where(eq(resumes.template, id));
		if (n > 0) {
			throw new Error(
				`${n} resume${n === 1 ? "" : "s"} still use this template — deactivate it instead`,
			);
		}
		await db.delete(templates).where(eq(templates.id, id));
		return { ok: true };
	});

/* ---------- Plans (pricing) ---------- */

export const listPlansAdmin = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const rows = await db
			.select()
			.from(plans)
			.orderBy(asc(plans.priceInr), asc(plans.name));
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			priceInr: r.priceInr,
			currency: r.currency,
			durationDays: r.durationDays,
			isActive: r.isActive,
			updatedAt: r.updatedAt.getTime(),
		}));
	});

/** Edits price/duration/name/active for an existing plan. Id is immutable. */
export const updatePlan = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(
		(input: {
			id: string;
			name?: string;
			priceInr?: number;
			durationDays?: number;
			isActive?: boolean;
		}) => {
			if (!isSlug(input.id)) throw new Error("Invalid plan id");
			const name = str(input.name, 60);
			if (!name) throw new Error("Name is required");
			const priceInr = Math.trunc(Number(input.priceInr));
			if (!Number.isFinite(priceInr) || priceInr < 1) {
				throw new Error("Price must be a positive whole number of rupees");
			}
			const durationDays = Math.trunc(Number(input.durationDays));
			if (!Number.isFinite(durationDays) || durationDays < 1) {
				throw new Error("Duration must be at least 1 day");
			}
			return {
				id: input.id,
				name,
				priceInr,
				durationDays,
				isActive: input.isActive !== false,
			};
		},
	)
	.handler(async ({ data }) => {
		const { id, ...set } = data;
		const res = await db
			.update(plans)
			.set({ ...set, updatedAt: new Date() })
			.where(eq(plans.id, id))
			.returning({ id: plans.id });
		if (res.length === 0) throw new Error(`Plan "${id}" not found`);
		return { ok: true };
	});

/**
 * Job-ingestion health for the admin panel — reads the EC2 job store via the jobs
 * HTTP shim. `jobs-db` is dynamically imported so it never enters the client bundle.
 * Returns `configured:false` when EC2_JOBS_URL is unset, so the page renders cleanly.
 */
export const adminJobsStatus = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		if (!process.env.EC2_JOBS_URL) {
			return { configured: false as const };
		}
		const { jobsStatus } = await import("#/lib/jobs-db");
		try {
			const status = await jobsStatus(30);
			if (!status) return { configured: false as const };
			return { configured: true as const, ...status };
		} catch (e) {
			// Surface the reason (unreachable DB, auth, etc.) so admins can diagnose.
			throw new Error(
				`Could not reach the job store: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	});
