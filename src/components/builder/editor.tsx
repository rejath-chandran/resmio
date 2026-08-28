import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { improveText } from "#/lib/ai-functions";
import { useBuilderStore } from "#/lib/builder-store";
import type { ResumeData } from "#/lib/resume-schema";
import { m } from "#/paraglide/messages";

/** Shared AI-improve button: rewrites the current text via improveText server fn. */
export function AiImproveButton({
	text,
	kind,
	onDone,
}: {
	text: string;
	kind: "summary" | "bullet";
	onDone: (t: string) => void;
}) {
	const improve = useServerFn(improveText);
	const [pending, setPending] = useState(false);
	if (!text.trim()) return null;
	return (
		<button
			type="button"
			disabled={pending}
			onClick={async () => {
				setPending(true);
				const { text: improved } = await improve({ data: { text, kind } });
				if (improved) onDone(improved);
				setPending(false);
			}}
			className="btn-ghost text-brand-300 hover:text-brand-200"
		>
			✦ {pending ? m.builder_ai_working() : m.builder_ai_improve()}
		</button>
	);
}

export function Field({
	label,
	value,
	onChange,
	type = "text",
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: string;
	placeholder?: string;
}) {
	return (
		<label className="block">
			<span className="label">{label}</span>
			<input
				type={type}
				className="input"
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	);
}

export function BasicsSection() {
	const data = useBuilderStore((s) => s.data);
	const update = useBuilderStore((s) => s.update);
	const setBasic = (key: keyof ResumeData["basics"]) => (v: string) =>
		update((d) => {
			d.basics[key] = v;
		});

	return (
		<section className="card p-6">
			<h2 className="font-display text-lg font-semibold text-white">
				{m.builder_basics()}
			</h2>
			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				<Field
					label={m.builder_full_name()}
					value={data.basics.fullName}
					onChange={setBasic("fullName")}
				/>
				<Field
					label={m.builder_email()}
					value={data.basics.email}
					onChange={setBasic("email")}
					type="email"
				/>
				<Field
					label={m.builder_phone()}
					value={data.basics.phone}
					onChange={setBasic("phone")}
				/>
				<Field
					label={m.builder_location()}
					value={data.basics.location}
					onChange={setBasic("location")}
				/>
				<Field
					label={m.builder_website()}
					value={data.basics.website}
					onChange={setBasic("website")}
				/>
			</div>
			<div className="mt-4">
				<div className="flex items-center justify-between">
					<span className="label">{m.builder_summary()}</span>
					<AiImproveButton
						text={data.basics.summary}
						kind="summary"
						onDone={(t) =>
							update((d) => {
								d.basics.summary = t;
							})
						}
					/>
				</div>
				<textarea
					className="input min-h-24 resize-y"
					value={data.basics.summary}
					aria-label={m.builder_summary()}
					onChange={(e) =>
						update((d) => {
							d.basics.summary = e.target.value;
						})
					}
				/>
			</div>
		</section>
	);
}

export function ExperienceSection() {
	const data = useBuilderStore((s) => s.data);
	const update = useBuilderStore((s) => s.update);

	const add = () =>
		update((d) =>
			d.experience.push({
				id: crypto.randomUUID(),
				company: "",
				role: "",
				start: "",
				end: "",
				current: false,
				bullets: [""],
			}),
		);
	const patch = (id: string, p: Partial<ResumeData["experience"][number]>) =>
		update((d) => {
			const e = d.experience.find((x) => x.id === id);
			if (e) Object.assign(e, p);
		});

	return (
		<section className="card p-6">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg font-semibold text-white">
					{m.builder_experience()}
				</h2>
				<button type="button" onClick={add} className="btn-ghost">
					+ {m.builder_add_experience()}
				</button>
			</div>
			<div className="mt-4 space-y-6">
				{data.experience.map((exp) => (
					<div
						key={exp.id}
						className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4"
					>
						<div className="flex items-start justify-between">
							<div className="grid flex-1 gap-3 sm:grid-cols-2">
								<Field
									label={m.builder_role()}
									value={exp.role}
									onChange={(v) => patch(exp.id, { role: v })}
								/>
								<Field
									label={m.builder_company()}
									value={exp.company}
									onChange={(v) => patch(exp.id, { company: v })}
								/>
								<Field
									label={m.builder_start()}
									value={exp.start}
									onChange={(v) => patch(exp.id, { start: v })}
									placeholder="2021-01"
								/>
								<Field
									label={m.builder_end()}
									value={exp.current ? "" : exp.end}
									onChange={(v) => patch(exp.id, { end: v })}
									placeholder={exp.current ? "—" : "2023-06"}
								/>
							</div>
							<button
								type="button"
								aria-label={m.dash_delete()}
								onClick={() =>
									update((d) => {
										d.experience = d.experience.filter((x) => x.id !== exp.id);
									})
								}
								className="btn-ghost hover:text-red-400"
							>
								✕
							</button>
						</div>
						<label className="mt-2 flex items-center gap-2 text-sm text-neutral-300">
							<input
								type="checkbox"
								checked={exp.current}
								onChange={(e) => patch(exp.id, { current: e.target.checked })}
								className="accent-brand-500"
							/>
							{m.builder_current()}
						</label>
						<div className="mt-3 space-y-2">
							{exp.bullets.map((b, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: bullets are append-only and never reordered
								<div key={i} className="flex items-start gap-2">
									<textarea
										className="input min-h-10 flex-1 resize-y"
										value={b}
										onChange={(e) =>
											patch(exp.id, {
												bullets: exp.bullets.map((x, j) =>
													j === i ? e.target.value : x,
												),
											})
										}
									/>
									<div className="flex flex-col gap-1">
										<AiImproveButton
											text={b}
											kind="bullet"
											onDone={(t) =>
												patch(exp.id, {
													bullets: exp.bullets.map((x, j) => (j === i ? t : x)),
												})
											}
										/>
										<button
											type="button"
											aria-label={m.dash_delete()}
											onClick={() =>
												patch(exp.id, {
													bullets: exp.bullets.filter((_, j) => j !== i),
												})
											}
											className="btn-ghost hover:text-red-400"
										>
											✕
										</button>
									</div>
								</div>
							))}
							<button
								type="button"
								onClick={() => patch(exp.id, { bullets: [...exp.bullets, ""] })}
								className="btn-ghost"
							>
								+ bullet
							</button>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export function EducationSection() {
	const data = useBuilderStore((s) => s.data);
	const update = useBuilderStore((s) => s.update);

	const add = () =>
		update((d) =>
			d.education.push({
				id: crypto.randomUUID(),
				school: "",
				degree: "",
				start: "",
				end: "",
			}),
		);

	return (
		<section className="card p-6">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-lg font-semibold text-white">
					{m.builder_education()}
				</h2>
				<button type="button" onClick={add} className="btn-ghost">
					+ {m.builder_add_education()}
				</button>
			</div>
			<div className="mt-4 space-y-4">
				{data.education.map((edu) => (
					<div
						key={edu.id}
						className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4"
					>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field
								label={m.builder_school()}
								value={edu.school}
								onChange={(v) =>
									update((d) => {
										const e = d.education.find((x) => x.id === edu.id);
										if (e) e.school = v;
									})
								}
							/>
							<Field
								label={m.builder_degree()}
								value={edu.degree}
								onChange={(v) =>
									update((d) => {
										const e = d.education.find((x) => x.id === edu.id);
										if (e) e.degree = v;
									})
								}
							/>
							<Field
								label={m.builder_start()}
								value={edu.start}
								onChange={(v) =>
									update((d) => {
										const e = d.education.find((x) => x.id === edu.id);
										if (e) e.start = v;
									})
								}
							/>
							<Field
								label={m.builder_end()}
								value={edu.end}
								onChange={(v) =>
									update((d) => {
										const e = d.education.find((x) => x.id === edu.id);
										if (e) e.end = v;
									})
								}
							/>
						</div>
						<button
							type="button"
							aria-label={m.dash_delete()}
							onClick={() =>
								update((d) => {
									d.education = d.education.filter((x) => x.id !== edu.id);
								})
							}
							className="btn-ghost mt-3 hover:text-red-400"
						>
							✕ {m.dash_delete()}
						</button>
					</div>
				))}
			</div>
		</section>
	);
}

export function SkillsSection() {
	const skills = useBuilderStore((s) => s.data.skills);
	const update = useBuilderStore((s) => s.update);
	const [draft, setDraft] = useState("");

	const add = () => {
		const v = draft.trim().slice(0, 50);
		if (!v || skills.includes(v)) return;
		update((d) => void d.skills.push(v));
		setDraft("");
	};

	return (
		<section className="card p-6">
			<h2 className="font-display text-lg font-semibold text-white">
				{m.builder_skills()}
			</h2>
			<div className="mt-3 flex flex-wrap gap-2">
				{skills.map((s) => (
					<span
						key={s}
						className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-200"
					>
						{s}
						<button
							type="button"
							aria-label={m.dash_delete()}
							onClick={() =>
								update((d) => {
									d.skills = d.skills.filter((x) => x !== s);
								})
							}
							className="text-neutral-500 hover:text-red-400"
						>
							✕
						</button>
					</span>
				))}
			</div>
			<div className="mt-3 flex gap-2">
				<input
					className="input flex-1"
					value={draft}
					placeholder={m.builder_add_skill()}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}}
				/>
				<button type="button" onClick={add} className="btn-secondary">
					+
				</button>
			</div>
		</section>
	);
}
