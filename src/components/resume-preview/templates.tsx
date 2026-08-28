import type { ResumeData } from "#/lib/resume-schema";

/**
 * A4 resume sheet renderers. Pure components over ResumeData so they work
 * identically in the live preview and in print-to-PDF.
 */

type TemplateProps = { data: ResumeData };

const fmtRange = (
	start: string,
	end: string,
	current: boolean,
	present: string,
) => [start, current ? present : end].filter(Boolean).join(" – ");

export function ResumeSheet({
	data,
	template,
	presentLabel,
}: TemplateProps & { template: string; presentLabel: string }) {
	switch (template) {
		case "classic":
			return <Classic data={data} presentLabel={presentLabel} />;
		case "minimal":
			return <Minimal data={data} presentLabel={presentLabel} />;
		default:
			return <Modern data={data} presentLabel={presentLabel} />;
	}
}

/* ---------- shared bits ---------- */

function Header({ data }: { data: ResumeData }) {
	const { basics } = data;
	const contacts = [
		basics.email,
		basics.phone,
		basics.location,
		basics.website,
	].filter(Boolean);
	return (
		<div className="text-center">
			<h1 className="text-2xl font-bold text-neutral-900">
				{basics.fullName || " "}
			</h1>
			{contacts.length > 0 && (
				<p className="mt-1 text-[11px] text-neutral-600">
					{contacts.join(" · ")}
				</p>
			)}
		</div>
	);
}

function SectionTitle({
	children,
	classic,
}: {
	children: string;
	classic?: boolean;
}) {
	return (
		<h2
			className={`mb-2 mt-4 text-[11px] font-bold tracking-widest uppercase ${
				classic
					? "border-b border-neutral-300 pb-0.5 text-neutral-800"
					: "text-neutral-900"
			}`}
		>
			{children}
		</h2>
	);
}

function ExperienceList({
	data,
	presentLabel,
	twoCol = false,
}: {
	data: ResumeData;
	presentLabel: string;
	twoCol?: boolean;
}) {
	return (
		<div className={twoCol ? "space-y-3" : "space-y-3"}>
			{data.experience.map((e) => (
				<div key={e.id}>
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-[12px] font-semibold text-neutral-900">
							{e.role}
							{e.company && (
								<span className="font-normal text-neutral-600">
									{" "}
									· {e.company}
								</span>
							)}
						</span>
						<span className="shrink-0 text-[10px] text-neutral-500">
							{fmtRange(e.start, e.end, e.current, presentLabel)}
						</span>
					</div>
					<ul className="mt-1 list-disc space-y-0.5 pl-4">
						{e.bullets.filter(Boolean).map((b, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: bullets are append-only and never reordered
							<li key={i} className="text-[11px] leading-snug text-neutral-700">
								{b}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}

function EducationList({
	data,
	presentLabel,
}: {
	data: ResumeData;
	presentLabel: string;
}) {
	return (
		<div className="space-y-2">
			{data.education.map((e) => (
				<div key={e.id} className="flex items-baseline justify-between gap-2">
					<span className="text-[12px] font-semibold text-neutral-900">
						{e.degree}
						{e.school && (
							<span className="font-normal text-neutral-600">
								{" "}
								· {e.school}
							</span>
						)}
					</span>
					<span className="shrink-0 text-[10px] text-neutral-500">
						{fmtRange(e.start, e.end, false, presentLabel)}
					</span>
				</div>
			))}
		</div>
	);
}

function Skills({ data }: { data: ResumeData }) {
	if (data.skills.length === 0) return null;
	return (
		<p className="text-[11px] leading-relaxed text-neutral-700">
			{data.skills.join(" · ")}
		</p>
	);
}

function Summary({ text }: { text: string }) {
	if (!text) return null;
	return (
		<p className="mt-2 text-[11px] leading-relaxed text-neutral-700">{text}</p>
	);
}

/* ---------- Modern: two-column, left sidebar ---------- */

function Modern({
	data,
	presentLabel,
}: TemplateProps & { presentLabel: string }) {
	const { basics } = data;
	const contacts = [
		basics.email,
		basics.phone,
		basics.location,
		basics.website,
	];
	return (
		<div className="grid h-full grid-cols-[35%_1fr]">
			<div className="bg-neutral-100 px-6 py-8">
				<h1 className="text-xl font-bold text-neutral-900">
					{basics.fullName || " "}
				</h1>
				<SectionTitle>Contact</SectionTitle>
				<div className="space-y-1 text-[10px] break-words text-neutral-700">
					{contacts.filter(Boolean).map((c) => (
						<p key={c}>{c}</p>
					))}
				</div>
				{data.skills.length > 0 && (
					<>
						<SectionTitle>Skills</SectionTitle>
						<div className="flex flex-wrap gap-1">
							{data.skills.map((s) => (
								<span
									key={s}
									className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] text-neutral-700"
								>
									{s}
								</span>
							))}
						</div>
					</>
				)}
			</div>
			<div className="px-6 py-8">
				{basics.summary && (
					<>
						<SectionTitle>Summary</SectionTitle>
						<p className="text-[11px] leading-relaxed text-neutral-700">
							{basics.summary}
						</p>
					</>
				)}
				<SectionTitle>Experience</SectionTitle>
				<ExperienceList data={data} presentLabel={presentLabel} />
				<SectionTitle>Education</SectionTitle>
				<EducationList data={data} presentLabel={presentLabel} />
			</div>
		</div>
	);
}

/* ---------- Classic: centered header, serif-ish, ruled sections ---------- */

function Classic({
	data,
	presentLabel,
}: TemplateProps & { presentLabel: string }) {
	return (
		<div className="px-12 py-10 font-serif">
			<Header data={data} />
			<Summary text={data.basics.summary} />
			<SectionTitle classic>Experience</SectionTitle>
			<ExperienceList data={data} presentLabel={presentLabel} />
			<SectionTitle classic>Education</SectionTitle>
			<EducationList data={data} presentLabel={presentLabel} />
			<SectionTitle classic>Skills</SectionTitle>
			<Skills data={data} />
		</div>
	);
}

/* ---------- Minimal: single column, generous whitespace ---------- */

function Minimal({
	data,
	presentLabel,
}: TemplateProps & { presentLabel: string }) {
	const { basics } = data;
	const contacts = [
		basics.email,
		basics.phone,
		basics.location,
		basics.website,
	].filter(Boolean);
	return (
		<div className="px-12 py-10">
			<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
				{basics.fullName || " "}
			</h1>
			{contacts.length > 0 && (
				<p className="mt-1 text-[11px] text-neutral-500">
					{contacts.join("  ·  ")}
				</p>
			)}
			<Summary text={basics.summary} />
			<SectionTitle>Experience</SectionTitle>
			<ExperienceList data={data} presentLabel={presentLabel} />
			<SectionTitle>Education</SectionTitle>
			<EducationList data={data} presentLabel={presentLabel} />
			<SectionTitle>Skills</SectionTitle>
			<Skills data={data} />
		</div>
	);
}
