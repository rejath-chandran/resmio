import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { resumes } from "#/db/schema";
import { authMiddleware } from "#/lib/auth-middleware";
import { emptyResume, parseResumeData } from "#/lib/resume-schema";

export type ResumeMeta = {
	id: string;
	title: string;
	template: string;
	updatedAt: number;
};

export type Resume = ResumeMeta & { data: unknown };

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
		template: ["modern", "classic", "minimal"].includes(input.template ?? "")
			? (input.template as string)
			: "modern",
	}))
	.handler(async ({ context, data }) => {
		const [row] = await db
			.insert(resumes)
			.values({
				id: crypto.randomUUID(),
				userId: context.user.id,
				title: data.title,
				template: data.template,
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
				template:
					input.template === undefined ||
					!["modern", "classic", "minimal"].includes(input.template)
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
		await db
			.update(resumes)
			.set({
				...(data.title !== undefined && { title: data.title }),
				...(data.template !== undefined && { template: data.template }),
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
