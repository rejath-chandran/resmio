import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { getBillingState } from "#/lib/billing-functions";
import { matchJobs } from "#/lib/jobs-functions";
import { listResumes } from "#/lib/resume-functions";

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
	component: Jobs,
});

type Mode = "resume" | "manual";
// Drag-drop reads text client-side (zero deps), so only text-based files work.
// ponytail: PDF/DOCX resumes → use "Existing resume" or paste; add a parser (pdfjs)
// behind this when uploaded binaries become common.
const ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";

function Jobs() {
	const { data: billing, isPending: billingPending } = useQuery({
		queryKey: ["billing"],
		queryFn: () => getBillingState(),
	});
	const { data: resumes = [] } = useQuery({
		queryKey: ["resumes"],
		queryFn: listResumes,
	});

	const [mode, setMode] = useState<Mode>("resume");
	const [resumeId, setResumeId] = useState("");
	const [upload, setUpload] = useState<{ name: string; text: string } | null>(
		null,
	);
	const [role, setRole] = useState("");
	const [skills, setSkills] = useState("");
	const [location, setLocation] = useState("");
	const [prefs, setPrefs] = useState("");

	const chosenResume = resumeId || resumes[0]?.id || "";
	const canSearch =
		mode === "manual"
			? Boolean(role.trim() || skills.trim() || location.trim())
			: Boolean(upload || chosenResume);

	const match = useMutation({
		mutationFn: () => {
			if (mode === "manual") {
				const queryText = [
					role.trim() && `Role: ${role.trim()}`,
					skills.trim() && `Skills: ${skills.trim()}`,
					location.trim() && `Location: ${location.trim()}`,
				]
					.filter(Boolean)
					.join("\n");
				return matchJobs({ data: { queryText, jobDescription: prefs } });
			}
			if (upload)
				return matchJobs({
					data: { queryText: upload.text, jobDescription: prefs },
				});
			return matchJobs({
				data: { resumeId: chosenResume, jobDescription: prefs },
			});
		},
	});

	return (
		<main className="mx-auto max-w-3xl px-6 py-12">
			<Link to="/dashboard" className="btn-ghost">
				← Dashboard
			</Link>
			<h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
				AI Job Match
			</h1>
			<p className="mt-2 text-sm text-neutral-400">
				Matches live openings by meaning, not just keywords. Search with your
				resume or by role, skills and location — every result links out to the
				original posting to apply.
			</p>

			{billingPending ? (
				<p className="mt-8 text-neutral-500">…</p>
			) : !billing?.pro ? (
				<LockedCard />
			) : (
				<div className="mt-6 space-y-4">
					<div className="card p-4 sm:p-6">
						<ModeTabs mode={mode} onChange={setMode} />

						{mode === "resume" ? (
							<ResumePanel
								resumes={resumes}
								chosenResume={chosenResume}
								onPick={setResumeId}
								upload={upload}
								onUpload={setUpload}
							/>
						) : (
							<ManualPanel
								role={role}
								skills={skills}
								location={location}
								setRole={setRole}
								setSkills={setSkills}
								setLocation={setLocation}
							/>
						)}

						<label className="mt-4 block text-sm font-medium text-neutral-300">
							Extra preferences (optional)
							<textarea
								className="input mt-1.5 h-20 w-full resize-y"
								placeholder="e.g. remote only, startups, no on-call"
								value={prefs}
								onChange={(e) => setPrefs(e.target.value)}
							/>
						</label>

						<button
							type="button"
							className="btn-primary mt-5 w-full sm:w-auto"
							disabled={!canSearch || match.isPending}
							onClick={() => match.mutate()}
						>
							{match.isPending ? "Matching…" : "Find matches"}
						</button>
					</div>

					{match.error && (
						<p className="text-sm text-red-400" role="alert">
							{match.error instanceof Error
								? match.error.message
								: "Match failed."}
						</p>
					)}

					{match.data && <Results result={match.data} />}
				</div>
			)}
		</main>
	);
}

function ModeTabs({
	mode,
	onChange,
}: {
	mode: Mode;
	onChange: (m: Mode) => void;
}) {
	const tabs: Array<{ id: Mode; label: string }> = [
		{ id: "resume", label: "Use a resume" },
		{ id: "manual", label: "Search manually" },
	];
	return (
		<div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
			{tabs.map((t) => (
				<button
					key={t.id}
					type="button"
					aria-pressed={mode === t.id}
					onClick={() => onChange(t.id)}
					className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
						mode === t.id
							? "bg-brand-500 text-white"
							: "text-neutral-400 hover:text-neutral-200"
					}`}
				>
					{t.label}
				</button>
			))}
		</div>
	);
}

function ManualPanel({
	role,
	skills,
	location,
	setRole,
	setSkills,
	setLocation,
}: {
	role: string;
	skills: string;
	location: string;
	setRole: (v: string) => void;
	setSkills: (v: string) => void;
	setLocation: (v: string) => void;
}) {
	return (
		<div className="mt-5 grid gap-4 sm:grid-cols-2">
			<label className="block text-sm font-medium text-neutral-300 sm:col-span-2">
				Role or title
				<input
					className="input mt-1.5 w-full"
					placeholder="e.g. Senior Backend Engineer"
					value={role}
					onChange={(e) => setRole(e.target.value)}
				/>
			</label>
			<label className="block text-sm font-medium text-neutral-300">
				Skills
				<input
					className="input mt-1.5 w-full"
					placeholder="e.g. Python, Postgres, AWS"
					value={skills}
					onChange={(e) => setSkills(e.target.value)}
				/>
			</label>
			<label className="block text-sm font-medium text-neutral-300">
				Location
				<input
					className="input mt-1.5 w-full"
					placeholder="e.g. Remote, Bangalore"
					value={location}
					onChange={(e) => setLocation(e.target.value)}
				/>
			</label>
		</div>
	);
}

function ResumePanel({
	resumes,
	chosenResume,
	onPick,
	upload,
	onUpload,
}: {
	resumes: Array<{ id: string; title: string }>;
	chosenResume: string;
	onPick: (id: string) => void;
	upload: { name: string; text: string } | null;
	onUpload: (u: { name: string; text: string } | null) => void;
}) {
	const [dragging, setDragging] = useState(false);
	const [err, setErr] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	async function take(file: File | undefined) {
		setErr("");
		if (!file) return;
		if (file.size > 1_000_000) {
			setErr("File too large — keep it under 1 MB.");
			return;
		}
		const text = (await file.text()).trim();
		if (!text) {
			setErr(
				"Couldn't read text. For PDF/Word, use an existing resume instead.",
			);
			return;
		}
		onUpload({ name: file.name, text });
	}

	return (
		<div className="mt-5">
			{/** biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps a real file input + button */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					void take(e.dataTransfer.files[0]);
				}}
				className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
					dragging
						? "border-brand-500 bg-brand-500/5"
						: "border-neutral-700 hover:border-neutral-600"
				}`}
			>
				{upload ? (
					<div className="flex items-center gap-2 text-sm">
						<span className="truncate font-medium text-white">
							📄 {upload.name}
						</span>
						<button
							type="button"
							className="text-neutral-500 hover:text-red-400"
							onClick={() => onUpload(null)}
							aria-label="Remove uploaded file"
						>
							✕
						</button>
					</div>
				) : (
					<>
						<p className="text-sm text-neutral-300">
							Drag a resume here, or{" "}
							<button
								type="button"
								className="font-medium text-brand-300 hover:text-brand-200"
								onClick={() => inputRef.current?.click()}
							>
								browse
							</button>
						</p>
						<p className="mt-1 text-xs text-neutral-600">
							.txt or .md — max 1 MB
						</p>
					</>
				)}
				<input
					ref={inputRef}
					type="file"
					accept={ACCEPT}
					className="hidden"
					onChange={(e) => void take(e.target.files?.[0])}
				/>
			</div>
			{err && <p className="mt-2 text-xs text-red-400">{err}</p>}

			<div className="my-4 flex items-center gap-3 text-xs text-neutral-600">
				<span className="h-px flex-1 bg-neutral-800" />
				or pick an existing resume
				<span className="h-px flex-1 bg-neutral-800" />
			</div>

			<select
				className="input w-full"
				value={chosenResume}
				disabled={Boolean(upload)}
				onChange={(e) => onPick(e.target.value)}
			>
				{resumes.length === 0 && <option value="">No resumes yet</option>}
				{resumes.map((r) => (
					<option key={r.id} value={r.id}>
						{r.title}
					</option>
				))}
			</select>
			{upload && (
				<p className="mt-1.5 text-xs text-neutral-600">
					Using the uploaded file — remove it to search by a saved resume.
				</p>
			)}
		</div>
	);
}

function siteOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "posting";
	}
}

function postedAgo(ts: number | null): string {
	if (!ts) return "";
	const days = Math.round((Date.now() - ts) / 86_400_000);
	if (days <= 0) return "today";
	if (days === 1) return "1 day ago";
	if (days < 30) return `${days} days ago`;
	return new Date(ts).toLocaleDateString();
}

function Results({
	result,
}: {
	result: Awaited<ReturnType<typeof matchJobs>>;
}) {
	if (!result.configured) {
		return (
			<p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
				Job Match isn't configured on this environment yet.
			</p>
		);
	}
	if (result.jobs.length === 0) {
		return (
			<p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
				No matches found — add more detail and try again.
			</p>
		);
	}
	return (
		<div>
			<p className="mb-3 text-xs text-neutral-500">
				{result.jobs.length} openings
				{result.source === "ai"
					? " · AI-ranked by fit"
					: " · ranked by relevance"}
			</p>
			<ul className="space-y-2">
				{result.jobs.map((j) => (
					<JobCard key={j.id} job={j} />
				))}
			</ul>
		</div>
	);
}

function JobCard({
	job: j,
}: {
	job: Awaited<ReturnType<typeof matchJobs>>["jobs"][number];
}) {
	const posted = postedAgo(j.postedAt);
	return (
		<li className="card flex items-center justify-between gap-4 p-4">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium text-white">{j.title}</span>
					{j.remote && (
						<span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
							remote
						</span>
					)}
				</div>
				<p className="truncate text-sm text-neutral-400">
					{j.company}
					{j.location ? ` · ${j.location}` : ""}
				</p>
				<p className="mt-0.5 truncate text-xs text-neutral-600">
					{siteOf(j.url)}
					{posted ? ` · ${posted}` : ""}
				</p>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-2">
				<span
					className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
					title="semantic match"
				>
					{Math.round(j.score * 100)}% match
				</span>
				<a
					href={j.url}
					target="_blank"
					rel="noopener noreferrer"
					className="btn-secondary"
				>
					Apply ↗
				</a>
			</div>
		</li>
	);
}

function LockedCard() {
	return (
		<div className="card mt-6 p-6 text-center">
			<div className="text-2xl">🔒</div>
			<h2 className="mt-2 font-semibold text-white">
				AI Job Match is a Pro feature
			</h2>
			<p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
				Upgrade to match against thousands of live openings, ranked by fit.
			</p>
			<Link to="/dashboard/billing" className="btn-primary mt-5 inline-flex">
				Upgrade to Pro
			</Link>
		</div>
	);
}
