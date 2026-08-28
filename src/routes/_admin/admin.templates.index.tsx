import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
	deleteTemplate,
	listAllTemplates,
	setTemplateActive,
} from "#/lib/admin-functions";
import { Problem } from "./admin.index";

export const Route = createFileRoute("/_admin/admin/templates/")({
	component: AdminTemplates,
});

function AdminTemplates() {
	const queryClient = useQueryClient();
	const { data, isPending, error } = useQuery({
		queryKey: ["admin", "templates"],
		queryFn: () => listAllTemplates(),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });
	const toggle = useMutation({
		mutationFn: (v: { id: string; isActive: boolean }) =>
			setTemplateActive({ data: v }),
		onSuccess: invalidate,
	});
	const remove = useMutation({
		mutationFn: (id: string) => deleteTemplate({ data: id }),
		onSuccess: invalidate,
	});

	if (error) return <Problem error={error} />;
	const failure = toggle.error ?? remove.error;

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-display text-2xl font-bold tracking-tight text-white">
						Templates
					</h1>
					<p className="mt-1 text-sm text-neutral-400">
						A template is a layout plus a theme. New themes ship without a
						deploy; a new layout needs code.
					</p>
				</div>
				<Link
					to="/admin/templates/$templateId"
					params={{ templateId: "new" }}
					className="btn-primary"
				>
					+ New template
				</Link>
			</div>

			{failure && (
				<p className="mt-4 text-sm text-red-400" role="alert">
					{failure instanceof Error ? failure.message : String(failure)}
				</p>
			)}

			{isPending ? (
				<p className="mt-8 text-neutral-500">…</p>
			) : (
				<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{data?.map((t) => (
						<div key={t.id} className="card flex flex-col p-5">
							<div className="flex items-start gap-3">
								<span
									className="mt-1 h-8 w-8 shrink-0 rounded"
									style={{ background: t.theme.accent }}
									aria-hidden
								/>
								<div className="min-w-0 flex-1">
									<h2 className="truncate font-semibold text-white">
										{t.name}
									</h2>
									<p className="text-xs text-neutral-500">
										{t.layout} · {t.theme.font} · {t.theme.density}
									</p>
								</div>
								{!t.isActive && (
									<span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] tracking-wide text-neutral-400 uppercase">
										off
									</span>
								)}
								{t.isPro && (
									<span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] tracking-wide text-brand-300 uppercase">
										pro
									</span>
								)}
							</div>
							<p className="mt-3 flex-1 text-xs text-neutral-400">
								{t.description || "No description."}
							</p>
							<p className="mt-3 text-xs text-neutral-600">
								{t.usage} resume{t.usage === 1 ? "" : "s"} · {t.id}
							</p>
							<div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-3">
								<Link
									to="/admin/templates/$templateId"
									params={{ templateId: t.id }}
									className="btn-ghost"
								>
									Edit
								</Link>
								<button
									type="button"
									className="btn-ghost"
									onClick={() =>
										toggle.mutate({ id: t.id, isActive: !t.isActive })
									}
								>
									{t.isActive ? "Deactivate" : "Activate"}
								</button>
								<button
									type="button"
									className="btn-ghost ml-auto hover:text-red-400"
									onClick={() => {
										if (window.confirm(`Delete template “${t.name}”?`))
											remove.mutate(t.id);
									}}
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</main>
	);
}
