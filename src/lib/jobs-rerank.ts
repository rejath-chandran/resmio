/**
 * Pure, client-safe helpers for job matching — no db/pg/server imports, so both the
 * server fn and the offline check (jobs.check.mjs) can use them.
 */
import type { JobRow } from "#/lib/jobs-db";

/** pgvector text literal: '[0.1,0.2,...]'. Kept identical to worker/db.py `_vec`. */
export function vecLiteral(vec: number[]): string {
	return `[${vec.map((x) => x.toFixed(6)).join(",")}]`;
}

/**
 * Parses the LLM's re-rank reply — a JSON array of 0-based indices into the candidate
 * list — into a clean, de-duped, in-range order. Tolerates prose/markdown around it.
 * Returns [] when nothing usable is found (caller keeps the vector order).
 */
export function parseRerankOrder(raw: string, n: number): number[] {
	const match = raw.match(/\[[\s\S]*?\]/);
	if (!match) return [];
	let arr: unknown;
	try {
		arr = JSON.parse(match[0]);
	} catch {
		return [];
	}
	if (!Array.isArray(arr)) return [];
	const seen = new Set<number>();
	const out: number[] = [];
	for (const x of arr) {
		const i = typeof x === "number" ? x : Number(x);
		if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) {
			seen.add(i);
			out.push(i);
		}
	}
	return out;
}

/**
 * Reorders `jobs` by `order` (indices into `jobs`); any jobs the model omitted keep
 * their original relative order at the end, so we never drop candidates.
 */
export function applyRerank(jobs: JobRow[], order: number[]): JobRow[] {
	if (order.length === 0) return jobs;
	const used = new Set(order);
	const ranked = order.map((i) => jobs[i]);
	const rest = jobs.filter((_, i) => !used.has(i));
	return [...ranked, ...rest];
}
