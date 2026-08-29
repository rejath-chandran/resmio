import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { atsBand, computeAtsReport, resumeToText } from "#/lib/ats";
import { atsReview } from "#/lib/ats-functions";
import { useBuilderStore } from "#/lib/builder-store";
import { m } from "#/paraglide/messages";

const BAND_COLOR = { low: "#ef4444", mid: "#f59e0b", high: "#22c55e" } as const;

/** Circular gauge for the 0–100 ATS score. */
function Gauge({ score }: { score: number }) {
	const color = BAND_COLOR[atsBand(score)];
	const deg = (score / 100) * 360;
	return (
		<div
			className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
			style={{
				background: `conic-gradient(${color} ${deg}deg, rgb(38 38 38) ${deg}deg)`,
			}}
		>
			<div className="grid h-20 w-20 place-items-center rounded-full bg-neutral-950">
				<span className="text-2xl font-bold text-white">{score}</span>
				<span className="text-[10px] text-neutral-500">/ 100</span>
			</div>
		</div>
	);
}

export function AtsPanel({ pro }: { pro: boolean }) {
	const data = useBuilderStore((s) => s.data);
	const [jd, setJd] = useState("");
	const [aiTips, setAiTips] = useState<string[]>([]);
	const [pending, setPending] = useState(false);
	const [aiNote, setAiNote] = useState("");
	const review = useServerFn(atsReview);

	const report = useMemo(() => computeAtsReport(data, jd), [data, jd]);

	if (!pro) {
		return (
			<section className="card relative overflow-hidden p-6">
				<h2 className="font-display text-lg font-semibold text-white">
					{m.ats_title()}
				</h2>
				<div className="mt-4 select-none blur-sm" aria-hidden>
					<Gauge score={72} />
					<p className="mt-3 text-sm text-neutral-400">
						{m.ats_locked_blurb()}
					</p>
				</div>
				<div className="absolute inset-0 grid place-items-center bg-neutral-950/70 p-6 text-center">
					<div>
						<p className="text-sm text-neutral-300">{m.ats_locked_blurb()}</p>
						<Link
							to="/dashboard/billing"
							className="btn-primary mt-3 inline-block"
						>
							{m.ats_unlock()}
						</Link>
					</div>
				</div>
			</section>
		);
	}

	async function runAi() {
		setPending(true);
		setAiNote("");
		try {
			const { suggestions, source } = await review({
				data: { resumeText: resumeToText(data), jobDescription: jd },
			});
			setAiTips(suggestions);
			if (source === "fallback" && suggestions.length === 0)
				setAiNote(m.ats_ai_unavailable());
		} catch (err) {
			setAiNote(err instanceof Error ? err.message : m.ats_ai_unavailable());
		} finally {
			setPending(false);
		}
	}

	return (
		<section className="card space-y-5 p-6">
			<div className="flex items-center gap-4">
				<Gauge score={report.score} />
				<div>
					<h2 className="font-display text-lg font-semibold text-white">
						{m.ats_title()}
					</h2>
					<p className="mt-1 text-sm text-neutral-400">{m.ats_subtitle()}</p>
				</div>
			</div>

			{/* Category breakdown */}
			<div className="space-y-2">
				{report.categories.map((c) => {
					const pct = Math.round((c.score / c.max) * 100);
					return (
						<div key={c.key}>
							<div className="flex justify-between text-xs text-neutral-400">
								<span>{c.label}</span>
								<span>
									{c.score}/{c.max}
								</span>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
								<div
									className="h-full rounded-full"
									style={{
										width: `${pct}%`,
										background: BAND_COLOR[atsBand(pct)],
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>

			{/* Suggestions */}
			{report.suggestions.length > 0 && (
				<div>
					<h3 className="label">{m.ats_suggestions()}</h3>
					<ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-300">
						{report.suggestions.map((s) => (
							<li key={s}>{s}</li>
						))}
					</ul>
				</div>
			)}

			{/* Target job description */}
			<div>
				<span className="label">{m.ats_jd_label()}</span>
				<textarea
					className="input min-h-20 resize-y"
					value={jd}
					placeholder={m.ats_jd_placeholder()}
					aria-label={m.ats_jd_label()}
					onChange={(e) => setJd(e.target.value)}
				/>
				{jd.trim() && report.missingKeywords.length > 0 && (
					<p className="mt-2 text-xs text-neutral-400">
						{m.ats_missing_keywords()}{" "}
						<span className="text-amber-400">
							{report.missingKeywords.join(", ")}
						</span>
					</p>
				)}
			</div>

			{/* AI review */}
			<div>
				<button
					type="button"
					disabled={pending}
					onClick={runAi}
					className="btn-secondary"
				>
					✦ {pending ? m.ats_ai_working() : m.ats_ai_button()}
				</button>
				{aiNote && <p className="mt-2 text-xs text-neutral-500">{aiNote}</p>}
				{aiTips.length > 0 && (
					<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-200">
						{aiTips.map((t) => (
							<li key={t}>{t}</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
