import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";

import { db } from "#/db";
import { resumes } from "#/db/schema";
import { resumeToText } from "#/lib/ats";
import { authMiddleware } from "#/lib/auth-middleware";
import type { JobRow } from "#/lib/jobs-db";
import { applyRerank, parseRerankOrder } from "#/lib/jobs-rerank";
import { parseResumeData } from "#/lib/resume-schema";

/**
 * AI Job Match — Pro only. Embeds the user's resume via the job-worker's embed shim
 * (same bge-small-en-v1.5 model → vectors are cosine-comparable), ranks active jobs in
 * the worker's Postgres+pgvector store, and optionally LLM-re-ranks the top slice.
 *
 * Server-fn only exports (this file is imported by the client route — see
 * src/lib/roles.ts). `pg`/`db` live behind dynamic imports so they never hit the
 * client bundle. Degrades gracefully to `configured:false` when the EC2 env is unset,
 * exactly like billing.
 */
export const matchJobs = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		(input: {
			resumeId?: string;
			queryText?: string;
			jobDescription?: string;
			limit?: number;
		}) => ({
			resumeId: String(input.resumeId ?? "").slice(0, 40),
			// Free-text query: skills/role/location typed manually, or text of a dropped
			// resume file. Takes precedence over resumeId when present.
			queryText: (input.queryText ?? "").slice(0, 4000),
			jobDescription: (input.jobDescription ?? "").slice(0, 4000),
			limit: Math.min(Math.max(Number(input.limit) || 25, 1), 50),
		}),
	)
	.handler(async ({ context, data }) => {
		const { isProUser } = await import("#/lib/entitlements");
		if (!(await isProUser(context.user.id))) {
			throw new Error("AI Job Match is a Pro feature — upgrade to unlock it.");
		}

		const embedUrl = process.env.EC2_EMBED_URL;
		if (!embedUrl || !process.env.EC2_JOBS_DATABASE_URL) {
			return {
				configured: false as const,
				jobs: [] as JobRow[],
				source: "none" as const,
			};
		}

		// Text to embed: manual/uploaded query wins; else flatten the chosen resume to
		// the same text shape the worker embeds jobs with (symmetric, no query prefix).
		let queryText = data.queryText.trim();
		if (!queryText) {
			if (!data.resumeId)
				throw new Error("Choose a resume or enter search terms.");
			const [row] = await db
				.select({ data: resumes.data })
				.from(resumes)
				.where(
					and(
						eq(resumes.id, data.resumeId),
						eq(resumes.userId, context.user.id),
					),
				);
			if (!row) throw new Error("Resume not found.");
			queryText = resumeToText(parseResumeData(JSON.parse(row.data))).trim();
		}
		if (!queryText) {
			return {
				configured: true as const,
				jobs: [] as JobRow[],
				source: "vector" as const,
			};
		}

		// Embed via the worker shim.
		const vec = await embedResume(embedUrl, queryText);
		if (!vec) {
			return {
				configured: true as const,
				jobs: [] as JobRow[],
				source: "vector" as const,
			};
		}

		const { matchByVector } = await import("#/lib/jobs-db");
		let jobs = await matchByVector(vec, data.limit);
		let source: "vector" | "ai" = "vector";

		// Optional LLM re-rank of the top slice against resume + JD. Best-effort: any
		// failure keeps the vector order.
		if (jobs.length > 1) {
			const reranked = await rerank(
				jobs.slice(0, 15),
				queryText,
				data.jobDescription,
			);
			if (reranked) {
				jobs = [...reranked, ...jobs.slice(15)];
				source = "ai";
			}
		}
		return { configured: true as const, jobs, source };
	});

/** POSTs resume text to the worker's embed shim; null on any failure (caller degrades). */
async function embedResume(
	base: string,
	text: string,
): Promise<number[] | null> {
	try {
		const res = await fetch(`${base.replace(/\/$/, "")}/embed`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { embedding?: number[] };
		return Array.isArray(json.embedding) ? json.embedding : null;
	} catch {
		return null;
	}
}

/** Asks the LLM to reorder the candidates; returns null when unavailable/unusable. */
async function rerank(
	jobs: JobRow[],
	resumeText: string,
	jobDescription: string,
): Promise<JobRow[] | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
	const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
	const list = jobs
		.map((j, i) => `${i}. ${j.title} @ ${j.company} (${j.location})`)
		.join("\n");
	const jd = jobDescription.trim()
		? `\n\nTarget role / preferences:\n${jobDescription}`
		: "";
	try {
		const res = await fetch(`${baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				max_tokens: 256,
				messages: [
					{ role: "system", content: RERANK_SYSTEM },
					{
						role: "user",
						content: `Resume:\n${resumeText.slice(0, 4000)}${jd}\n\nJobs:\n${list}\n\nReturn the best-fit order as a JSON array of the numbers above, best first.`,
					},
				],
			}),
			signal: AbortSignal.timeout(20_000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const raw = json.choices?.[0]?.message?.content ?? "";
		const order = parseRerankOrder(raw, jobs.length);
		return order.length ? applyRerank(jobs, order) : null;
	} catch {
		return null;
	}
}

const RERANK_SYSTEM = `You rank job postings by fit for a candidate's resume.
Consider role, seniority, skills overlap and any stated preferences.
Output ONLY a JSON array of the given 0-based indices, best fit first, no prose.`;
