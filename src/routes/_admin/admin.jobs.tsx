import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { adminJobsStatus } from "#/lib/admin-functions";
import { Problem } from "#/routes/_admin/admin.index";

export const Route = createFileRoute("/_admin/admin/jobs")({
	component: AdminJobs,
});

function fmt(ts: number | null): string {
	if (!ts) return "—";
	const mins = Math.round((Date.now() - ts) / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.round(mins / 60);
	if (hrs < 48) return `${hrs}h ago`;
	return new Date(ts).toLocaleDateString();
}

function AdminJobs() {
	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["admin", "jobs"],
		queryFn: () => adminJobsStatus(),
	});

	if (error) return <Problem error={error} />;

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-bold tracking-tight text-white">
						Job ingestion
					</h1>
					<p className="mt-1 text-sm text-neutral-400">
						Live view of the EC2 scraper's store — use freshness to see if
						scraping is running.
					</p>
				</div>
				<button
					type="button"
					className="btn-secondary"
					disabled={isFetching}
					onClick={() => refetch()}
				>
					{isFetching ? "Refreshing…" : "Refresh"}
				</button>
			</div>

			{isPending ? (
				<p className="mt-8 text-neutral-500">…</p>
			) : data && data.configured === false ? (
				<div className="card mt-8 border-amber-900/50 p-6">
					<h2 className="font-semibold text-amber-300">Not configured</h2>
					<p className="mt-2 text-sm text-neutral-400">
						Set <code>EC2_JOBS_DATABASE_URL</code> to point at the job-worker's
						Postgres.
					</p>
				</div>
			) : data ? (
				<>
					<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Stat label="Total jobs" value={data.total} />
						<Stat label="Active" value={data.active} hint="live now" />
						<Stat label="Embedded" value={data.embedded} hint="have vectors" />
						<Stat
							label="Last fetch"
							value={fmt(data.lastFetchedAt)}
							hint="freshness"
						/>
					</div>

					<section className="card mt-8 p-5">
						<h2 className="section-title">By source</h2>
						<ul className="mt-4 space-y-2">
							{data.bySource.map((s) => (
								<li key={s.source} className="flex items-center gap-3 text-sm">
									<span className="w-28 shrink-0 truncate text-neutral-300">
										{s.source}
									</span>
									<span className="text-neutral-500">
										{s.active} active / {s.n} total
									</span>
								</li>
							))}
						</ul>
					</section>

					<section className="card mt-6 p-5">
						<h2 className="section-title">Recently fetched</h2>
						<div className="mt-4 overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead className="text-xs tracking-widest text-neutral-500 uppercase">
									<tr>
										<th className="pb-2 pr-4">Title</th>
										<th className="pb-2 pr-4">Company</th>
										<th className="pb-2 pr-4">Source</th>
										<th className="pb-2 pr-4">Fetched</th>
										<th className="pb-2">State</th>
									</tr>
								</thead>
								<tbody className="text-neutral-300">
									{data.recent.map((j) => (
										<tr key={j.url} className="border-t border-neutral-800/70">
											<td className="py-2 pr-4">
												<a
													href={j.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-brand-300 hover:text-brand-200"
												>
													{j.title}
												</a>
											</td>
											<td className="py-2 pr-4">{j.company}</td>
											<td className="py-2 pr-4 text-neutral-500">{j.source}</td>
											<td className="py-2 pr-4 text-neutral-500">
												{fmt(j.fetchedAt)}
											</td>
											<td className="py-2">
												{j.active ? (
													<span className="text-brand-400">active</span>
												) : (
													<span className="text-neutral-600">inactive</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</>
			) : null}

			<div className="mt-8">
				<Link to="/admin" className="btn-ghost">
					← Overview
				</Link>
			</div>
		</main>
	);
}

function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: number | string;
	hint?: string;
}) {
	return (
		<div className="card p-5">
			<p className="text-xs tracking-widest text-neutral-500 uppercase">
				{label}
			</p>
			<p className="mt-2 text-3xl font-bold text-white">{value}</p>
			{hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
		</div>
	);
}
