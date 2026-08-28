import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { resumes, templates } from "#/db/schema";
import { authMiddleware } from "#/lib/auth-middleware";
import { emptyResume, parseResumeData } from "#/lib/resume-schema";
import { isSlug, parseTheme, type TemplateTheme } from "#/lib/templates";

export type ResumeMeta = {
	id: string;
	title: string;
	template: string;
	updatedAt: number;
};

export type Resume = ResumeMeta & { data: unknown };

export type TemplateOption = {
	id: string;
	name: string;
	description: string;
	layout: string;
	theme: TemplateTheme;
	isPro: boolean;
};

/** Active templates, for the builder dropdown and dashboard thumbnails. */
export const listTemplates = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		const rows = await db
			.select()
			.from(templates)
			.where(eq(templates.isActive, true))
			.orderBy(asc(templates.sortOrder), asc(templates.name));
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			layout: r.layout,
			theme: parseTheme(JSON.parse(r.theme)),
			isPro: r.isPro,
		})) satisfies TemplateOption[];
	});

/** Resolves a template id to an existing, active row; null when it isn't one. */
async function activeTemplate(id: string) {
	if (!isSlug(id)) return null;
	const [row] = await db
		.select({ id: templates.id })
		.from(templates)
		.where(and(eq(templates.id, id), eq(templates.isActive, true)));
	return row?.id ?? null;
}

export const listResumes = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const rows = await db
			.select()
			.from(resumes)
			.where(eq(resumes.userId, context.user.id))
			.orderBy(desc(resumes.updatedAt));
		return rows.map((r) => ({
			id: r.id,
			title: r.title,
			template: r.template,
			updatedAt: r.updatedAt.getTime(),
		})) satisfies ResumeMeta[];
	});

export const getResume = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((id: string) => id.slice(0, 40))
	.handler(async ({ context, data: id }) => {
		const [row] = await db
			.select()
			.from(resumes)
			.where(and(eq(resumes.id, id), eq(resumes.userId, context.user.id)));
		if (!row) return null;
		return {
			id: row.id,
			title: row.title,
			template: row.template,
			updatedAt: row.updatedAt.getTime(),
			data: JSON.parse(row.data),
		} satisfies Resume;
	});

export const createResume = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { title?: string; template?: string }) => ({
		title: (input.title ?? "").slice(0, 120) || "Untitled resume",
		template: input.template ?? "modern",
	}))
	.handler(async ({ context, data }) => {
		const [row] = await db
			.insert(resumes)
			.values({
				id: crypto.randomUUID(),
				userId: context.user.id,
				title: data.title,
				// Unknown or deactivated template falls back rather than failing the
				// create — the dropdown is the only place a valid id comes from.
				template: (await activeTemplate(data.template)) ?? "modern",
				data: JSON.stringify(emptyResume()),
			})
			.returning();
		return { id: row.id };
	});

export const updateResume = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		(input: {
			id: string;
			title?: string;
			template?: string;
			data?: unknown;
		}) => {
			if (typeof input.id !== "string" || input.id.length > 40) {
				throw new Error("Invalid resume id");
			}
			return {
				id: input.id,
				title:
					input.title === undefined ? undefined : input.title.slice(0, 120),
				// Existence is checked in the handler — validators can't await.
				template:
					input.template === undefined || !isSlug(input.template)
						? undefined
						: input.template,
				data:
					input.data === undefined
						? undefined
						: JSON.stringify(parseResumeData(input.data)),
			};
		},
	)
	.handler(async ({ context, data }) => {
		const template =
			data.template === undefined
				? undefined
				: ((await activeTemplate(data.template)) ?? undefined);
		await db
			.update(resumes)
			.set({
				...(data.title !== undefined && { title: data.title }),
				...(template !== undefined && { template }),
				...(data.data !== undefined && { data: data.data }),
				updatedAt: new Date(),
			})
			.where(and(eq(resumes.id, data.id), eq(resumes.userId, context.user.id)));
		return { ok: true };
	});

export const deleteResume = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((id: string) => id.slice(0, 40))
	.handler(async ({ context, data: id }) => {
		await db
			.delete(resumes)
			.where(and(eq(resumes.id, id), eq(resumes.userId, context.user.id)));
		return { ok: true };
	});
