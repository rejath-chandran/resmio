import type { ResumeData } from "#/lib/resume-schema";
import type { TemplateTheme } from "#/lib/templates";

/**
 * Shared building blocks for resume layouts. Pure components over ResumeData so
 * they render identically in the live preview and in the server-rendered PDF.
 * Colours come from the --t-* CSS vars set by ResumeSheet (see lib/templates.ts).
 */

export type LayoutProps = {
	data: ResumeData;
	theme: TemplateTheme;
	presentLabel: string;
};

export const fmtRange = (
	start: string,
	end: string,
	current: boolean,
	present: string,
) => [start, current ? present : end].filter(Boolean).join(" – ");

export const contactList = (basics: ResumeData["basics"]) =>
	[basics.email, basics.phone, basics.location, basics.website].filter(Boolean);

/** Contact line plus any links (shows the URL, falling back to the label). */
export const contactWithLinks = (data: ResumeData) => [
	...contactList(data.basics),
	...data.links.map((l) => l.url || l.label).filter(Boolean),
];

/** Vertical rhythm driven by the theme's density. */
export function Stack({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-col" style={{ gap: "var(--t-gap)" }}>
			{children}
		</div>
	);
}

export function SectionTitle({
	children,
	variant = "plain",
}: {
	children: string;
	variant?: "plain" | "ruled" | "accent" | "block";
}) {
	const base = "text-[11px] font-bold tracking-widest uppercase";
	if (variant === "ruled") {
		return (
			<h2
				className={`${base} mb-2 border-b pb-0.5`}
				style={{ borderColor: "var(--t-accent)", color: "var(--t-ink)" }}
			>
				{children}
			</h2>
		);
	}
	if (variant === "accent") {
		return (
			<h2 className={`${base} mb-2`} style={{ color: "var(--t-accent)" }}>
				{children}
			</h2>
		);
	}
	if (variant === "block") {
		return (
			<h2
				className={`${base} mb-2 inline-block px-1.5 py-0.5 text-white`}
				style={{ background: "var(--t-accent)" }}
			>
				{children}
			</h2>
		);
	}
	return (
		<h2 className={`${base} mb-2`} style={{ color: "var(--t-ink)" }}>
			{children}
		</h2>
	);
}

export function EntryHead({
	title,
	subtitle,
	meta,
}: {
	title: string;
	subtitle?: string;
	meta?: string;
}) {
	return (
		<div className="flex items-baseline justify-between gap-2">
			<span
				className="text-[12px] font-semibold"
				style={{ color: "var(--t-ink)" }}
			>
				{title}
				{subtitle && (
					<span className="font-normal opacity-70"> · {subtitle}</span>
				)}
			</span>
			{meta && <span className="shrink-0 text-[10px] opacity-60">{meta}</span>}
		</div>
	);
}

export function Bullets({ items }: { items: string[] }) {
	const visible = items.filter(Boolean);
	if (visible.length === 0) return null;
	return (
		<ul className="mt-1 list-disc space-y-0.5 pl-4">
			{visible.map((b, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: bullets are append-only and never reordered
				<li key={i} className="text-[11px] leading-snug opacity-85">
					{b}
				</li>
			))}
		</ul>
	);
}

export function ExperienceList({
	data,
	presentLabel,
}: {
	data: ResumeData;
	presentLabel: string;
}) {
	return (
		<div className="space-y-3">
			{data.experience.map((e) => (
				<div key={e.id}>
					<EntryHead
						title={e.role}
						subtitle={e.company}
						meta={fmtRange(e.start, e.end, e.current, presentLabel)}
					/>
					<Bullets items={e.bullets} />
				</div>
			))}
		</div>
	);
}

export function EducationList({
	data,
	presentLabel,
}: {
	data: ResumeData;
	presentLabel: string;
}) {
	return (
		<div className="space-y-2">
			{data.education.map((e) => (
				<EntryHead
					key={e.id}
					title={e.degree}
					subtitle={e.school}
					meta={fmtRange(e.start, e.end, false, presentLabel)}
				/>
			))}
		</div>
	);
}

export function ProjectsList({ data }: { data: ResumeData }) {
	return (
		<div className="space-y-3">
			{data.projects.map((p) => (
				<div key={p.id}>
					<EntryHead title={p.name} meta={p.url} />
					{p.description && (
						<p className="mt-0.5 text-[11px] leading-snug opacity-85">
							{p.description}
						</p>
					)}
				</div>
			))}
		</div>
	);
}

export function SkillsInline({ data }: { data: ResumeData }) {
	if (data.skills.length === 0) return null;
	return (
		<p className="text-[11px] leading-relaxed opacity-85">
			{data.skills.join(" · ")}
		</p>
	);
}

export function SkillChips({ data }: { data: ResumeData }) {
	if (data.skills.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-1">
			{data.skills.map((s) => (
				<span
					key={s}
					className="rounded px-1.5 py-0.5 text-[9px]"
					style={{
						background: "color-mix(in oklab, var(--t-accent) 14%, transparent)",
						color: "var(--t-ink)",
					}}
				>
					{s}
				</span>
			))}
		</div>
	);
}

export function Summary({ text }: { text: string }) {
	if (!text) return null;
	return <p className="text-[11px] leading-relaxed opacity-85">{text}</p>;
}
