import {
	Bullets,
	contactWithLinks,
	EducationList,
	EntryHead,
	ExperienceList,
	fmtRange,
	type LayoutProps,
	ProjectsList,
	SectionTitle,
	SkillChips,
	SkillsInline,
	Stack,
	Summary,
} from "./shared";

/**
 * Layout engines. A template row names one of these by id (see LAYOUTS at the
 * bottom) and supplies a theme; colours arrive as --t-* CSS vars from
 * ResumeSheet, so nothing here hardcodes a palette or a font.
 *
 * Adding a layout: write the component, add one line to LAYOUTS. Nothing else
 * changes — the admin panel picks it up from LAYOUT_IDS.
 */

type Variant = React.ComponentProps<typeof SectionTitle>["variant"];

/** Titled section — every layout is a stack of these. */
function Sec({
	title,
	variant,
	children,
}: {
	title: string;
	variant?: Variant;
	children: React.ReactNode;
}) {
	return (
		<section>
			<SectionTitle variant={variant}>{title}</SectionTitle>
			{children}
		</section>
	);
}

/* ---------- Modern: tinted sidebar, two columns ---------- */

export function Modern({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div className="grid h-full grid-cols-[35%_1fr]">
			<div
				className="px-6 py-8"
				style={{
					background: "color-mix(in oklab, var(--t-accent) 10%, white)",
				}}
			>
				<h1 className="text-xl font-bold">{basics.fullName || " "}</h1>
				<div className="mt-5">
					<Stack>
						<Sec title="Contact" variant="accent">
							<div className="space-y-1 text-[10px] break-words opacity-80">
								{contactWithLinks(data).map((c) => (
									<p key={c}>{c}</p>
								))}
							</div>
						</Sec>
						{data.skills.length > 0 && (
							<Sec title="Skills" variant="accent">
								<SkillChips data={data} />
							</Sec>
						)}
					</Stack>
				</div>
			</div>
			<div className="px-6 py-8">
				<Stack>
					{basics.summary && (
						<Sec title="Summary" variant="accent">
							<Summary text={basics.summary} />
						</Sec>
					)}
					<Sec title="Experience" variant="accent">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="accent">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education" variant="accent">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Classic: centered header, ruled sections ---------- */

export function Classic({ data, presentLabel }: LayoutProps) {
	return (
		<div className="px-12 py-10">
			<div className="text-center">
				<h1 className="text-2xl font-bold">{data.basics.fullName || " "}</h1>
				<p className="mt-1 text-[11px] opacity-70">
					{contactWithLinks(data).join(" · ")}
				</p>
			</div>
			<div className="mt-6">
				<Stack>
					<Summary text={data.basics.summary} />
					<Sec title="Experience" variant="ruled">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="ruled">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education" variant="ruled">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
					<Sec title="Skills" variant="ruled">
						<SkillsInline data={data} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Minimal: single column, quiet ---------- */

export function Minimal({ data, presentLabel }: LayoutProps) {
	return (
		<div className="px-12 py-10">
			<h1 className="text-2xl font-semibold tracking-tight">
				{data.basics.fullName || " "}
			</h1>
			<p className="mt-1 text-[11px] opacity-60">
				{contactWithLinks(data).join("  ·  ")}
			</p>
			<div className="mt-6">
				<Stack>
					<Summary text={data.basics.summary} />
					<Sec title="Experience">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
					<Sec title="Skills">
						<SkillsInline data={data} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Sidebar: dark contact rail ---------- */

export function Sidebar({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div className="grid h-full grid-cols-[32%_1fr]">
			<div
				className="px-5 py-8 text-white"
				style={{ background: "var(--t-accent)" }}
			>
				<h1 className="text-lg leading-tight font-bold">
					{basics.fullName || " "}
				</h1>
				<div className="mt-6 space-y-1 text-[10px] break-words opacity-90">
					{contactWithLinks(data).map((c) => (
						<p key={c}>{c}</p>
					))}
				</div>
				{data.skills.length > 0 && (
					<div className="mt-6">
						<h2 className="mb-2 text-[11px] font-bold tracking-widest uppercase">
							Skills
						</h2>
						<div className="space-y-0.5 text-[10px] opacity-90">
							{data.skills.map((s) => (
								<p key={s}>{s}</p>
							))}
						</div>
					</div>
				)}
			</div>
			<div className="px-7 py-8">
				<Stack>
					{basics.summary && (
						<Sec title="Profile">
							<Summary text={basics.summary} />
						</Sec>
					)}
					<Sec title="Experience">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Timeline: date gutter against a vertical rule ---------- */

export function Timeline({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div className="px-10 py-9">
			<h1 className="text-2xl font-bold">{basics.fullName || " "}</h1>
			<p className="mt-1 text-[11px] opacity-65">
				{contactWithLinks(data).join(" · ")}
			</p>
			<div className="mt-6">
				<Stack>
					<Summary text={basics.summary} />
					<Sec title="Experience" variant="accent">
						<div
							className="space-y-4 border-l pl-4"
							style={{
								borderColor:
									"color-mix(in oklab, var(--t-accent) 40%, transparent)",
							}}
						>
							{data.experience.map((e) => (
								<div key={e.id} className="relative">
									<span
										className="absolute top-1.5 -left-[21px] block h-1.5 w-1.5 rounded-full"
										style={{ background: "var(--t-accent)" }}
									/>
									<p
										className="text-[10px] font-medium"
										style={{ color: "var(--t-accent)" }}
									>
										{fmtRange(e.start, e.end, e.current, presentLabel)}
									</p>
									<EntryHead title={e.role} subtitle={e.company} />
									<Bullets items={e.bullets} />
								</div>
							))}
						</div>
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="accent">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education" variant="accent">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
					<Sec title="Skills" variant="accent">
						<SkillsInline data={data} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Swiss: heavy type, geometric blocks, tight grid ---------- */

export function Swiss({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div className="px-10 py-9">
			<div
				className="border-b-4 pb-3"
				style={{ borderColor: "var(--t-accent)" }}
			>
				<h1 className="text-3xl leading-none font-black tracking-tighter uppercase">
					{basics.fullName || " "}
				</h1>
				<p className="mt-2 text-[10px] font-medium tracking-wide uppercase opacity-70">
					{contactWithLinks(data).join("  /  ")}
				</p>
			</div>
			<div className="mt-5">
				<Stack>
					<Summary text={basics.summary} />
					<Sec title="Experience" variant="block">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="block">
							<ProjectsList data={data} />
						</Sec>
					)}
					<div className="grid grid-cols-2 gap-5">
						<Sec title="Education" variant="block">
							<EducationList data={data} presentLabel={presentLabel} />
						</Sec>
						<Sec title="Skills" variant="block">
							<SkillChips data={data} />
						</Sec>
					</div>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Elegant: centered serif header, hairline rules ---------- */

export function Elegant({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div className="px-14 py-12 text-center">
			<h1 className="text-[26px] font-normal tracking-[0.18em] uppercase">
				{basics.fullName || " "}
			</h1>
			<div
				className="mx-auto mt-3 h-px w-16"
				style={{ background: "var(--t-accent)" }}
			/>
			<p className="mt-3 text-[10px] tracking-wide opacity-65">
				{contactWithLinks(data).join("   ·   ")}
			</p>
			<div className="mt-8 text-left">
				<Stack>
					<Summary text={basics.summary} />
					<Sec title="Experience" variant="ruled">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="ruled">
							<ProjectsList data={data} />
						</Sec>
					)}
					<Sec title="Education" variant="ruled">
						<EducationList data={data} presentLabel={presentLabel} />
					</Sec>
					<Sec title="Skills" variant="ruled">
						<SkillsInline data={data} />
					</Sec>
				</Stack>
			</div>
		</div>
	);
}

/* ---------- Editorial: two-tone header band ---------- */

export function Editorial({ data, presentLabel }: LayoutProps) {
	const { basics } = data;
	return (
		<div>
			<div
				className="px-10 py-7 text-white"
				style={{ background: "var(--t-accent)" }}
			>
				<h1 className="text-[26px] leading-tight font-bold">
					{basics.fullName || " "}
				</h1>
				{basics.summary && (
					<p className="mt-2 max-w-[85%] text-[11px] leading-relaxed opacity-90">
						{basics.summary}
					</p>
				)}
			</div>
			<div
				className="px-10 py-2 text-[10px]"
				style={{
					background: "color-mix(in oklab, var(--t-accent) 12%, white)",
				}}
			>
				{contactWithLinks(data).join("  ·  ")}
			</div>
			<div className="px-10 py-7">
				<Stack>
					<Sec title="Experience" variant="accent">
						<ExperienceList data={data} presentLabel={presentLabel} />
					</Sec>
					{data.projects.length > 0 && (
						<Sec title="Projects" variant="accent">
							<ProjectsList data={data} />
						</Sec>
					)}
					<div className="grid grid-cols-[1fr_38%] gap-6">
						<Sec title="Education" variant="accent">
							<EducationList data={data} presentLabel={presentLabel} />
						</Sec>
						<Sec title="Skills" variant="accent">
							<SkillChips data={data} />
						</Sec>
					</div>
				</Stack>
			</div>
		</div>
	);
}

/**
 * The registry. Template rows reference these keys via `templates.layout`;
 * LAYOUT_IDS drives the admin panel's layout picker.
 */
export const LAYOUTS = {
	modern: Modern,
	classic: Classic,
	minimal: Minimal,
	sidebar: Sidebar,
	timeline: Timeline,
	swiss: Swiss,
	elegant: Elegant,
	editorial: Editorial,
} satisfies Record<string, (p: LayoutProps) => React.ReactElement>;

export type LayoutId = keyof typeof LAYOUTS;

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

export const isLayoutId = (v: unknown): v is LayoutId =>
	typeof v === "string" && v in LAYOUTS;
