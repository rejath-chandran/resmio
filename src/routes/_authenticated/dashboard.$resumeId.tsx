import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AtsPanel } from "#/components/builder/ats-panel";
import {
	BasicsSection,
	EducationSection,
	ExperienceSection,
	LinksSection,
	ProjectsSection,
	SkillsSection,
} from "#/components/builder/editor";
import { ResumeSheet } from "#/components/resume-preview/templates";
import { atsBand, computeAtsReport } from "#/lib/ats";
import { getBillingState } from "#/lib/billing-functions";
import { setPersister, useBuilderStore } from "#/lib/builder-store";
import { exportResumeToPdf } from "#/lib/pdf-export";
import { getResume, listTemplates, updateResume } from "#/lib/resume-functions";
import { parseResumeData } from "#/lib/resume-schema";
import { DEFAULT_THEME } from "#/lib/templates";
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
	const { data: templateList } = useQuery({
		queryKey: ["templates"],
		queryFn: () => listTemplates(),
	});
	const { data: billing } = useQuery({
		queryKey: ["billing"],
		queryFn: () => getBillingState(),
	});
	const pro = billing?.pro ?? false;

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
	const [showAts, setShowAts] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const atsScore = computeAtsReport(data).score;
	const atsColor = { low: "#ef4444", mid: "#f59e0b", high: "#22c55e" }[
		atsBand(atsScore)
	];
	const active = templateList?.find((t) => t.id === template);

	if (!resume) return <div className="p-10 text-neutral-400">…</div>;

	return (
		<main className="flex min-h-[calc(100vh-65px)] flex-col">
			{/* Toolbar */}
			<div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-950/90 px-6 py-3 backdrop-blur">
				<Link to="/dashboard" className="btn-ghost">
					← {m.builder_back()}
				</Link>
				<input
					className="input w-56 min-w-0 max-w-xs flex-1"
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
						{/* The saved template may be deactivated; keep it selectable so
						    switching away is a choice, not a forced silent change. */}
						{!active && <option value={template}>{template}</option>}
						{templateList?.map((t) => (
							<option key={t.id} value={t.id} disabled={t.isPro && !pro}>
								{t.name}
								{t.isPro ? (pro ? " ★" : " 🔒 Pro") : ""}
							</option>
						))}
					</select>
					{templateList?.some((t) => t.isPro) && !pro && (
						<Link
							to="/dashboard/billing"
							className="text-xs text-brand-400 hover:text-brand-300"
						>
							Unlock Pro
						</Link>
					)}
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
					onClick={() => setShowPreview(true)}
					className="btn-ghost lg:hidden!"
				>
					👁 {m.builder_preview()}
				</button>
				{pro ? (
					<button
						type="button"
						onClick={() => setShowAts((v) => !v)}
						aria-pressed={showAts}
						className="btn-ghost flex items-center gap-1.5"
						title={m.ats_title()}
					>
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={{ background: atsColor }}
						/>
						{m.ats_chip()} {atsScore}
					</button>
				) : (
					<Link
						to="/dashboard/billing"
						className="btn-ghost"
						title={m.ats_title()}
					>
						🔒 {m.ats_chip()}
					</Link>
				)}
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

			<div className="flex flex-1 flex-col items-start justify-center gap-8 p-4 sm:p-6 lg:flex-row">
				{/* Editor */}
				<div className="w-full max-w-xl space-y-5">
					<BasicsSection />
					<ExperienceSection />
					<EducationSection />
					<ProjectsSection />
					<LinksSection />
					<SkillsSection />
				</div>
				{/* Live A4 preview — floats alongside the editor while scrolling (lg+).
				    Hidden below lg; small screens use the toggled overlay below. */}
				<div className="hidden self-start lg:sticky lg:top-[57px] lg:block">
					<div className="resume-sheet-zoom origin-top">
						<div className="resume-sheet" id="resume-sheet">
							<ResumeSheet
								data={data}
								layout={active?.layout ?? template}
								theme={active?.theme ?? DEFAULT_THEME}
								presentLabel={m.builder_present()}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Mobile/tablet preview overlay (below lg). */}
			{showPreview && (
				<div className="fixed inset-0 z-30 flex flex-col bg-neutral-950/95 lg:hidden">
					<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
						<span className="font-display font-semibold text-white">
							{m.builder_preview()}
						</span>
						<button
							type="button"
							onClick={() => setShowPreview(false)}
							aria-label="Close"
							className="btn-ghost px-3 text-lg leading-none"
						>
							✕
						</button>
					</div>
					<div className="flex-1 overflow-auto p-4">
						<div className="resume-sheet-zoom-overlay mx-auto origin-top">
							<div className="resume-sheet">
								<ResumeSheet
									data={data}
									layout={active?.layout ?? template}
									theme={active?.theme ?? DEFAULT_THEME}
									presentLabel={m.builder_present()}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ATS report — Pro; slide-in right drawer on all screen sizes. */}
			{showAts && pro && (
				<>
					<button
						type="button"
						aria-label="Close ATS panel"
						onClick={() => setShowAts(false)}
						className="fixed inset-0 z-10 bg-black/40 lg:hidden"
					/>
					<div className="fixed right-0 top-[57px] bottom-0 z-20 w-full max-w-sm overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4">
						<AtsPanel pro={pro} onClose={() => setShowAts(false)} />
					</div>
				</>
			)}
		</main>
	);
}
