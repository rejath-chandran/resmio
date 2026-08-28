import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { adminStats } from "#/lib/admin-functions";

export const Route = createFileRoute("/_admin/admin/")({
	component: AdminOverview,
});

function AdminOverview() {
	const { data, isPending, error } = useQuery({
		queryKey: ["admin", "stats"],
		queryFn: () => adminStats(),
	});

	if (error) return <Problem error={error} />;

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<h1 className="font-display text-2xl font-bold tracking-tight text-white">
				Overview
			</h1>
			<p className="mt-1 text-sm text-neutral-400">
				Resume contents are never shown here — only counts and metadata.
			</p>

			<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat label="Users" value={data?.users} pending={isPending} />
				<Stat
					label="New this week"
					value={data?.newUsersThisWeek}
					pending={isPending}
				/>
				<Stat label="Resumes" value={data?.resumes} pending={isPending} />
				<Stat
					label="Templates"
					value={data && `${data.activeTemplates} / ${data.templates}`}
					hint="active / total"
					pending={isPending}
				/>
			</div>

			<section className="card mt-8 p-5">
				<h2 className="section-title">Template usage</h2>
				{data?.byTemplate.length === 0 ? (
					<p className="mt-3 text-sm text-neutral-500">No resumes yet.</p>
				) : (
					<ul className="mt-4 space-y-2">
						{data?.byTemplate.map((row) => (
							<li key={row.template} className="flex items-center gap-3">
								<span className="w-28 shrink-0 truncate text-sm text-neutral-300">
									{row.template}
								</span>
								<span
									className="h-2 rounded-full bg-brand-500"
									style={{
										width: `${Math.max(2, (row.n / Math.max(1, data.resumes)) * 100)}%`,
									}}
								/>
								<span className="text-xs text-neutral-500">{row.n}</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<div className="mt-8 flex gap-3">
				<Link to="/admin/users" className="btn-secondary">
					Manage users
				</Link>
				<Link to="/admin/templates" className="btn-primary">
					Manage templates
				</Link>
			</div>
		</main>
	);
}

function Stat({
	label,
	value,
	hint,
	pending,
}: {
	label: string;
	value?: number | string;
	hint?: string;
	pending: boolean;
}) {
	return (
		<div className="card p-5">
			<p className="text-xs tracking-widest text-neutral-500 uppercase">
				{label}
			</p>
			<p className="mt-2 text-3xl font-bold text-white">
				{pending ? "…" : (value ?? 0)}
			</p>
			{hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
		</div>
	);
}

/** Shared error surface: admin fns throw with a reason worth showing. */
export function Problem({ error }: { error: unknown }) {
	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="card border-red-900/50 p-6" role="alert">
				<h1 className="font-semibold text-red-300">Something went wrong</h1>
				<p className="mt-2 text-sm text-neutral-400">
					{error instanceof Error ? error.message : String(error)}
				</p>
			</div>
		</main>
	);
}
