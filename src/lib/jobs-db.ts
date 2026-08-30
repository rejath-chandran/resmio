/**
 * Read-only access to the job-worker's Postgres+pgvector store (on EC2). Server-only —
 * dynamically imported inside a server-fn handler so `pg` never reaches the client
 * bundle (same rule as src/lib/roles.ts). Degrades to null when unconfigured.
 */
import { Pool } from "pg";

import { vecLiteral } from "#/lib/jobs-rerank";

let pool: Pool | null = null;

/** Lazily builds a small pool from EC2_JOBS_DATABASE_URL; null when the env is unset. */
export function jobsPool(): Pool | null {
	const url = process.env.EC2_JOBS_DATABASE_URL;
	if (!url) return null;
	if (!pool) {
		// Small pool + short timeout: this is a remote read for one interactive request.
		pool = new Pool({
			connectionString: url,
			max: 4,
			connectionTimeoutMillis: 5000,
		});
	}
	return pool;
}

export type JobRow = {
	id: string;
	title: string;
	company: string;
	location: string;
	remote: boolean;
	url: string;
	postedAt: number | null;
	score: number;
};

/** Cosine top-N over active, embedded jobs. Mirrors worker/match.py. */
export async function matchByVector(
	vec: number[],
	limit: number,
): Promise<JobRow[]> {
	const p = jobsPool();
	if (!p) return [];
	const v = vecLiteral(vec);
	const { rows } = await p.query(
		`SELECT id, title, company, location, remote, url, posted_at,
		        1 - (embedding <=> $1::vector) AS score
		 FROM jobs
		 WHERE active = true AND embedding IS NOT NULL
		 ORDER BY embedding <=> $1::vector
		 LIMIT $2`,
		[v, limit],
	);
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		company: r.company,
		location: r.location,
		remote: r.remote,
		url: r.url,
		postedAt: r.posted_at ? new Date(r.posted_at).getTime() : null,
		score: Number(r.score),
	}));
}

export type JobsStatus = {
	total: number;
	active: number;
	embedded: number;
	lastFetchedAt: number | null;
	bySource: Array<{ source: string; n: number; active: number }>;
	recent: Array<{
		title: string;
		company: string;
		source: string;
		fetchedAt: number | null;
		active: boolean;
		url: string;
	}>;
};

/** Ingestion health for the admin panel: counts, freshness, per-source, recent rows. */
export async function jobsStatus(recentLimit = 30): Promise<JobsStatus | null> {
	const p = jobsPool();
	if (!p) return null;
	const [totals, sources, recent] = await Promise.all([
		p.query(
			`SELECT count(*) total,
			        count(*) FILTER (WHERE active) active,
			        count(*) FILTER (WHERE embedding IS NOT NULL) embedded,
			        max(fetched_at) last_fetched
			 FROM jobs`,
		),
		p.query(
			`SELECT source, count(*) n, count(*) FILTER (WHERE active) active
			 FROM jobs GROUP BY source ORDER BY n DESC`,
		),
		p.query(
			`SELECT title, company, source, fetched_at, active, url
			 FROM jobs ORDER BY fetched_at DESC NULLS LAST LIMIT $1`,
			[recentLimit],
		),
	]);
	const t = totals.rows[0];
	return {
		total: Number(t.total),
		active: Number(t.active),
		embedded: Number(t.embedded),
		lastFetchedAt: t.last_fetched ? new Date(t.last_fetched).getTime() : null,
		bySource: sources.rows.map((r) => ({
			source: r.source,
			n: Number(r.n),
			active: Number(r.active),
		})),
		recent: recent.rows.map((r) => ({
			title: r.title,
			company: r.company,
			source: r.source,
			fetchedAt: r.fetched_at ? new Date(r.fetched_at).getTime() : null,
			active: r.active,
			url: r.url,
		})),
	};
}
