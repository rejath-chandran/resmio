import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ResumeMeta, TemplateOption } from "#/lib/resume-functions";
import {
	createResume,
	deleteResume,
	listResumes,
	listTemplates,
} from "#/lib/resume-functions";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/_authenticated/dashboard/")({
	component: Dashboard,
});

function Dashboard() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: resumes = [], isPending } = useQuery({
		queryKey: ["resumes"],
		queryFn: listResumes,
	});
	const { data: templates = [] } = useQuery({
		queryKey: ["templates"],
		queryFn: () => listTemplates(),
	});

	const create = useMutation({
		mutationFn: (title?: string) => createResume({ data: { title } }),
		onSuccess: async ({ id }) => {
			await queryClient.invalidateQueries({ queryKey: ["resumes"] });
			await navigate({ to: "/dashboard/$resumeId", params: { resumeId: id } });
		},
	});

	const del = useMutation({
		mutationFn: (id: string) => deleteResume({ data: id }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
	});

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-bold tracking-tight text-white">
						{m.dash_title()}
					</h1>
					<p className="mt-1 text-sm text-neutral-400">{m.dash_subtitle()}</p>
				</div>
				<button
					type="button"
					onClick={() => create.mutate(undefined)}
					disabled={create.isPending}
					className="btn-primary"
				>
					+ {m.dash_new_resume()}
				</button>
			</div>

			{isPending ? null : resumes.length === 0 ? (
				<div className="card mt-12 flex flex-col items-center px-8 py-20 text-center">
					<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-300">
						✦
					</div>
					<h2 className="mt-5 text-lg font-semibold text-white">
						{m.dash_empty_title()}
					</h2>
					<p className="mt-2 max-w-sm text-sm text-neutral-400">
						{m.dash_empty_desc()}
					</p>
					<button
						type="button"
						onClick={() => create.mutate(undefined)}
						disabled={create.isPending}
						className="btn-primary mt-6"
					>
						{m.dash_create_first()}
					</button>
				</div>
			) : (
				<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{resumes.map((r) => (
						<ResumeCard
							key={r.id}
							resume={r}
							template={templates.find((t) => t.id === r.template)}
							onOpen={() =>
								navigate({
									to: "/dashboard/$resumeId",
									params: { resumeId: r.id },
								})
							}
							onDelete={() => {
								if (window.confirm(m.dash_delete())) del.mutate(r.id);
							}}
						/>
					))}
				</div>
			)}
		</main>
	);
}

function ResumeCard({
	resume,
	template,
	onOpen,
	onDelete,
}: {
	resume: ResumeMeta;
	template?: TemplateOption;
	onOpen: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="card group flex flex-col p-5 transition-colors hover:border-neutral-600">
			<button type="button" onClick={onOpen} className="text-left">
				<div className="flex h-24 items-end overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-3">
					<MiniResumeSkeleton
						layout={template?.layout ?? resume.template}
						accent={template?.theme.accent ?? "#525252"}
					/>
				</div>
				<h3 className="mt-4 font-semibold text-white group-hover:text-brand-300">
					{resume.title}
				</h3>
			</button>
			<div className="mt-1 flex-1 text-xs text-neutral-500">
				{m.dash_last_edited({
					date: new Date(resume.updatedAt).toLocaleDateString(),
				})}{" "}
				· {template?.name ?? resume.template}
			</div>
			<div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-3">
				<button type="button" onClick={onOpen} className="btn-ghost">
					{m.dash_open()}
				</button>
				<button
					type="button"
					onClick={onDelete}
					className="btn-ghost hover:text-red-400"
				>
					{m.dash_delete()}
				</button>
			</div>
		</div>
	);
}

/**
 * Tiny layout hint tinted with the template's accent — not the real preview.
 * Rendering the actual sheet at thumbnail size costs a full layout pass per card.
 */
function MiniResumeSkeleton({
	layout,
	accent,
}: {
	layout: string;
	accent: string;
}) {
	const bar = "h-1 bg-neutral-800";
	const lines = (
		<>
			<div className={`${bar} w-full`} />
			<div className={`${bar} w-5/6`} />
			<div className={`${bar} w-2/3`} />
		</>
	);
	// Two-column layouts get a rail; banner layouts get a filled top strip;
	// everything else is a single stack under a heading.
	if (layout === "modern" || layout === "sidebar") {
		return (
			<div className="flex w-full gap-2">
				<div className="w-1/3 space-y-1.5 pr-2">
					<div className="h-1.5 w-full" style={{ background: accent }} />
					<div className={`${bar} w-3/4`} />
					<div className={`${bar} w-full`} />
				</div>
				<div className="flex-1 space-y-1.5">{lines}</div>
			</div>
		);
	}
	if (layout === "editorial") {
		return (
			<div className="w-full space-y-1.5">
				<div className="h-4 w-full rounded-sm" style={{ background: accent }} />
				{lines}
			</div>
		);
	}
	if (layout === "timeline") {
		return (
			<div className="flex w-full gap-2">
				<div className="w-px self-stretch" style={{ background: accent }} />
				<div className="flex-1 space-y-1.5">{lines}</div>
			</div>
		);
	}
	if (layout === "elegant") {
		return (
			<div className="w-full space-y-1.5">
				<div className="mx-auto h-1.5 w-1/2" style={{ background: accent }} />
				<div className="mx-auto h-px w-8" style={{ background: accent }} />
				<div className={`${bar} w-full`} />
				<div className={`${bar} w-5/6`} />
			</div>
		);
	}
	// classic, minimal, swiss and any future single-column layout
	return (
		<div className="w-full space-y-1.5">
			<div
				className={layout === "swiss" ? "h-2 w-3/4" : "h-1.5 w-1/2"}
				style={{ background: accent }}
			/>
			{lines}
		</div>
	);
}
