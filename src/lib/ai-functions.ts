import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";

import { db } from "#/db";
import { aiUsage } from "#/db/schema";
import { authMiddleware } from "#/lib/auth-middleware";
import { FREE_AI_CALLS_PER_DAY, isProUser, utcDay } from "#/lib/entitlements";

/**
 * AI text improvement. ponytail: prompt is a fixed template — when we add
 * tone/tone-length controls or per-section prompts, move it into a
 * configurable builder.
 */
export const improveText = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { text: string; kind?: "summary" | "bullet" }) => ({
		text: input.text.slice(0, 2000),
		kind: input.kind === "bullet" ? ("bullet" as const) : ("summary" as const),
	}))
	.handler(async ({ context, data }) => {
		// Free tier: capped AI calls per day. Pro: unlimited. Count before calling
		// the model so a failed generation doesn't burn the quota silently.
		if (!(await isProUser(context.user.id))) {
			await enforceAiQuota(context.user.id);
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey)
			return {
				text: localImprove(data.text, data.kind),
				source: "fallback" as const,
			};

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
					max_tokens: 1024,
					messages: [
						{ role: "system", content: SYSTEM },
						{ role: "user", content: buildPrompt(data.text, data.kind) },
					],
				}),
			});
			if (!res.ok)
				return {
					text: localImprove(data.text, data.kind),
					source: "fallback" as const,
				};
			const json = (await res.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			const text = json.choices?.[0]?.message?.content?.trim();
			return text
				? { text, source: "ai" as const }
				: {
						text: localImprove(data.text, data.kind),
						source: "fallback" as const,
					};
		} catch {
			return {
				text: localImprove(data.text, data.kind),
				source: "fallback" as const,
			};
		}
	});

/**
 * Atomically bumps today's AI counter and throws once the free cap is hit. The
 * upsert makes the increment race-safe under concurrent calls.
 */
async function enforceAiQuota(userId: string) {
	const day = utcDay();
	const [row] = await db
		.insert(aiUsage)
		.values({ userId, day, count: 1 })
		.onConflictDoUpdate({
			target: [aiUsage.userId, aiUsage.day],
			set: { count: sql`${aiUsage.count} + 1` },
		})
		.returning({ count: aiUsage.count });
	if ((row?.count ?? 0) > FREE_AI_CALLS_PER_DAY) {
		throw new Error(
			`Free plan allows ${FREE_AI_CALLS_PER_DAY} AI edits per day — upgrade to Pro for unlimited.`,
		);
	}
}

const SYSTEM = `You are an expert resume writer. Rewrite the user's resume text to be concise, impactful and professional.
- Use strong action verbs and quantify where plausible (never invent employers, dates, or credentials).
- For a summary: 2-3 sentences. For a bullet: one line.
- Output ONLY the rewritten text, no preamble, no quotes, no markdown.`;

function buildPrompt(text: string, kind: "summary" | "bullet"): string {
	return kind === "bullet"
		? `Rewrite this resume bullet point:\n\n${text}`
		: `Rewrite this professional summary for a resume:\n\n${text}`;
}

/** Deterministic heuristic used when no API key is configured. */
function localImprove(text: string, kind: "summary" | "bullet"): string {
	const cleaned = text.replace(/\s+/g, " ").trim();
	if (!cleaned) return "";
	const upgrades: Array<[RegExp, string]> = [
		[/\bworked on\b/gi, "developed"],
		[/\bhelped\b/gi, "supported"],
		[/\bmade\b/gi, "built"],
		[/\bdid\b/gi, "executed"],
		[/\bresponsible for\b/gi, "owned"],
		[/\bused\b/gi, "leveraged"],
		[/\bstuff\b/gi, "initiatives"],
		[/\bthings\b/gi, "deliverables"],
	];
	let out = cleaned;
	for (const [re, rep] of upgrades) out = out.replace(re, rep);
	if (kind === "bullet") {
		return out.charAt(0).toUpperCase() + out.slice(1);
	}
	const sentences = out.match(/[^.!?]+[.!?]?/g) ?? [out];
	return sentences
		.slice(0, 3)
		.map((s) => s.trim())
		.join(" ");
}
