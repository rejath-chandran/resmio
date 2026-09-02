/**
 * Read access to the job-worker's Postgres+pgvector store, via the EC2 jobs HTTP
 * shim (Workers can't hold Postgres connections — free-tier: no Hyperdrive). The
 * shim runs the cosine match / status queries and returns JSON. Degrades to
 * empty/null when EC2_JOBS_URL / EC2_JOBS_TOKEN are unset.
 */

const TIMEOUT_MS = 8000;

function shimEnv(): { url: string; token: string } | null {
	const url = process.env.EC2_JOBS_URL;
	const token = process.env.EC2_JOBS_TOKEN;
	return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function shimPost<T>(path: string, body: unknown): Promise<T | null> {
	const env = shimEnv();
	if (!env) return null;
	try {
		const res = await fetch(`${env.url}${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${env.token}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
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

/** Cosine top-N over active, embedded jobs. The EC2 shim mirrors worker/match.py. */
export async function matchByVector(
	vec: number[],
	limit: number,
): Promise<JobRow[]> {
	const rows = await shimPost<JobRow[]>("/match", { vec, limit });
	return rows ?? [];
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
	return shimPost<JobsStatus>("/status", { recentLimit });
}
