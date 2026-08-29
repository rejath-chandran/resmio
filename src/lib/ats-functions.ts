import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "#/lib/auth-middleware";

/**
 * ATS AI review — Pro only. Returns a handful of tailored suggestions on top of the
 * client-side heuristic (src/lib/ats.ts). Server-only exports: this file is imported by
 * the builder client, so it must export ONLY server fns (see src/lib/roles.ts). The Pro
 * check and OpenAI call live inside the handler; `db`-touching helpers are dynamically
 * imported so drizzle never reaches the client bundle.
 */
export const atsReview = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { resumeText: string; jobDescription?: string }) => ({
		resumeText: (input.resumeText ?? "").slice(0, 6000),
		jobDescription: (input.jobDescription ?? "").slice(0, 4000),
	}))
	.handler(async ({ context, data }) => {
		const { isProUser } = await import("#/lib/entitlements");
		if (!(await isProUser(context.user.id))) {
			throw new Error(
				"The ATS checker is a Pro feature — upgrade to unlock AI review.",
			);
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) return { suggestions: [], source: "fallback" as const };

		const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
		const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
		try {
			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					max_tokens: 512,
					messages: [
						{ role: "system", content: SYSTEM },
						{
							role: "user",
							content: buildPrompt(data.resumeText, data.jobDescription),
						},
					],
				}),
			});
			if (!res.ok) return { suggestions: [], source: "fallback" as const };
			const json = (await res.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
			return { suggestions: parseSuggestions(raw), source: "ai" as const };
		} catch {
			return { suggestions: [], source: "fallback" as const };
		}
	});

const SYSTEM = `You are an ATS (applicant tracking system) resume reviewer. Give specific, actionable suggestions to improve how well the resume passes ATS screening and matches the target role.
- Focus on measurable achievements, relevant keywords, standard section headings, and clarity.
- Never invent employers, dates, or credentials.
- Output ONLY a JSON array of 3-6 short suggestion strings, no prose, no markdown, no keys.`;

function buildPrompt(resumeText: string, jobDescription?: string): string {
	const jd = jobDescription?.trim()
		? `\n\nTarget job description:\n${jobDescription}`
		: "";
	return `Resume content:\n${resumeText}${jd}`;
}

/** Parses the model output into clean suggestion lines, tolerating non-JSON replies. */
function parseSuggestions(raw: string): string[] {
	let list: unknown;
	try {
		list = JSON.parse(raw);
	} catch {
		// Fallback: split bullet/numbered lines.
		return raw
			.split("\n")
			.map((l) => l.replace(/^\s*(?:[-*\d.)\]]+)\s*/, "").trim())
			.filter(Boolean)
			.slice(0, 6);
	}
	if (!Array.isArray(list)) return [];
	return list
		.filter((s): s is string => typeof s === "string")
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 6);
}
