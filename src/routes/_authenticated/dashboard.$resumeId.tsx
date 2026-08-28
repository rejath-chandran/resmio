import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	BasicsSection,
	EducationSection,
	ExperienceSection,
	SkillsSection,
} from "#/components/builder/editor";
import { ResumeSheet } from "#/components/resume-preview/templates";
import { setPersister, useBuilderStore } from "#/lib/builder-store";
import { exportResumeToPdf } from "#/lib/pdf-export";
import { getResume, updateResume } from "#/lib/resume-functions";
import { parseResumeData } from "#/lib/resume-schema";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/_authenticated/dashboard/$resumeId")({
	component: Builder,
});

function Builder() {
	const { resumeId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: resume } = useQuery({
		queryKey: ["resume", resumeId],
		queryFn: () => getResume({ data: resumeId }),
	});

	const load = useBuilderStore((s) => s.load);
	useEffect(() => {
		if (resume) load({ ...resume, data: parseResumeData(resume.data) });
	}, [resume, load]);

	// Inject the persist function (store stays UI-free of server fns).
	useEffect(() => {
		setPersister(async (state) => {
			await updateResume({
				data: {
					id: state.resumeId,
					title: state.title,
					template: state.template,
					data: state.data,
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["resumes"] });
		});
	}, [queryClient]);

	const title = useBuilderStore((s) => s.title);
	const template = useBuilderStore((s) => s.template);
	const data = useBuilderStore((s) => s.data);
	const status = useBuilderStore((s) => s.status);
	const setTitle = useBuilderStore((s) => s.setTitle);
	const setTemplate = useBuilderStore((s) => s.setTemplate);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState(false);

	if (!resume) return <div className="p-10 text-neutral-400">…</div>;

	return (
		<main className="flex min-h-[calc(100vh-65px)] flex-col">
			{/* Toolbar */}
			<div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-950/90 px-6 py-3 backdrop-blur">
				<Link to="/dashboard" className="btn-ghost">
					← {m.builder_back()}
				</Link>
				<input
					className="input w-56 flex-1 max-w-xs"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					aria-label="Resume title"
				/>
				<div className="flex items-center gap-2">
					<span className="text-xs text-neutral-500">
						{m.builder_template()}
					</span>
					<select
						className="input w-auto"
						value={template}
						onChange={(e) => setTemplate(e.target.value)}
					>
						<option value="modern">Modern</option>
						<option value="classic">Classic</option>
						<option value="minimal">Minimal</option>
					</select>
				</div>
				<span className="text-xs text-neutral-500" aria-live="polite">
					{status === "saving"
						? m.builder_saving()
						: status === "saved" || status === "dirty"
							? m.builder_saved()
							: ""}
				</span>
				<button
					type="button"
					disabled={exporting}
					onClick={async () => {
						setExporting(true);
						setExportError(false);
						try {
							await exportResumeToPdf("resume-sheet", title);
						} catch (err) {
							console.error("PDF export failed:", err);
							setExportError(true);
						} finally {
							setExporting(false);
						}
					}}
					className="btn-primary ml-auto"
				>
					↓ {exporting ? m.builder_exporting() : m.builder_download()}
				</button>
				{exportError && (
					<span className="text-xs text-red-400" role="alert">
						{m.builder_export_failed()}
					</span>
				)}
			</div>

			<div className="flex flex-1 items-start justify-center gap-8 overflow-auto p-6 lg:flex-row flex-col">
				{/* Editor */}
				<div className="w-full max-w-xl space-y-5">
					<BasicsSection />
					<ExperienceSection />
					<EducationSection />
					<SkillsSection />
				</div>
				{/* Live A4 preview */}
				<div className="resume-sheet-print-root sticky top-20 origin-top scale-[0.85] xl:scale-100">
					<div className="resume-sheet" id="resume-sheet">
						<ResumeSheet
							data={data}
							template={template}
							presentLabel={m.builder_present()}
						/>
					</div>
				</div>
			</div>
		</main>
	);
}
