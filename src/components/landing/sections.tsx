import { m } from "#/paraglide/messages";

// Landing animations are pure CSS (Interpolate keyframes in styles.css) instead
// of framer-motion: motion sets opacity:0 until JS hydrates, which delayed the
// hero H1 (the LCP element) by ~1.5s. CSS reveals content with zero JS.
export function Reveal({
	delay = 0,
	className = "",
	children,
}: {
	delay?: number;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`reveal ${className}`}
			style={delay ? { animationDelay: `${delay}s` } : undefined}
		>
			{children}
		</div>
	);
}

export function SectionHeading({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) {
	return (
		<Reveal className="mx-auto max-w-2xl text-center">
			<h2 className="section-title">{title}</h2>
			{subtitle && (
				<p className="mt-4 text-base leading-relaxed text-neutral-400">
					{subtitle}
				</p>
			)}
		</Reveal>
	);
}

export function Features() {
	const features = [
		{ icon: "✦", title: m.feature_ai_title(), desc: m.feature_ai_desc() },
		{
			icon: "▦",
			title: m.feature_templates_title(),
			desc: m.feature_templates_desc(),
		},
		{ icon: "◉", title: m.feature_live_title(), desc: m.feature_live_desc() },
		{
			icon: "↓",
			title: m.feature_export_title(),
			desc: m.feature_export_desc(),
		},
		{
			icon: "⛨",
			title: m.feature_privacy_title(),
			desc: m.feature_privacy_desc(),
		},
		{ icon: "🌐", title: m.feature_i18n_title(), desc: m.feature_i18n_desc() },
	];
	return (
		<section id="features" className="mx-auto max-w-6xl px-6 py-24">
			<SectionHeading
				title={m.features_title()}
				subtitle={m.features_subtitle()}
			/>
			<div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{features.map((f, i) => (
					<Reveal
						key={f.title}
						delay={(i % 3) * 0.08}
						className="card group p-6 transition-colors hover:border-neutral-700"
					>
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-lg text-brand-300 transition-colors group-hover:bg-brand-500/20">
							{f.icon}
						</div>
						<h3 className="mt-4 font-semibold text-white">{f.title}</h3>
						<p className="mt-2 text-sm leading-relaxed text-neutral-400">
							{f.desc}
						</p>
					</Reveal>
				))}
			</div>
		</section>
	);
}

export function HowItWorks() {
	const steps = [
		{ title: m.how_step1_title(), desc: m.how_step1_desc() },
		{ title: m.how_step2_title(), desc: m.how_step2_desc() },
		{ title: m.how_step3_title(), desc: m.how_step3_desc() },
	];
	return (
		<section
			id="how"
			className="border-y border-neutral-800/60 bg-neutral-900/40"
		>
			<div className="mx-auto max-w-6xl px-6 py-24">
				<SectionHeading title={m.how_title()} />
				<div className="mt-14 grid gap-10 md:grid-cols-3">
					{steps.map((s, i) => (
						<Reveal key={s.title} delay={i * 0.1} className="relative">
							<div className="font-display text-5xl font-bold text-neutral-800">
								{i + 1}
							</div>
							<div
								className="absolute left-0 top-1 h-12 w-12 rounded-full bg-brand-500/15 blur-xl"
								aria-hidden
							/>
							<h3 className="mt-4 font-semibold text-white">{s.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-neutral-400">
								{s.desc}
							</p>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function Pricing() {
	const freeFeatures = [
		m.feature_ai_writes(),
		m.feature_all_templates(),
		m.feature_pdf_export(),
	];
	const proFeatures = [
		m.feature_unlimited_resumes(),
		m.feature_priority_ai(),
		m.feature_multiple_versions(),
		m.feature_cover_letters(),
	];
	return (
		<section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
			<SectionHeading
				title={m.pricing_title()}
				subtitle={m.pricing_subtitle()}
			/>
			<div className="mx-auto mt-14 grid max-w-3xl gap-6 md:grid-cols-2">
				<Reveal className="card p-8">
					<h3 className="font-semibold text-white">{m.plan_free_name()}</h3>
					<div className="mt-3 flex items-baseline gap-1.5">
						<span className="font-display text-4xl font-bold text-white">
							{m.plan_free_price()}
						</span>
						<span className="text-sm text-neutral-500">
							{m.plan_free_period()}
						</span>
					</div>
					<p className="mt-3 text-sm text-neutral-400">{m.plan_free_desc()}</p>
					<ul className="mt-6 space-y-2.5">
						{freeFeatures.map((f) => (
							<li
								key={f}
								className="flex items-center gap-2.5 text-sm text-neutral-300"
							>
								<span className="text-brand-400">✓</span> {f}
							</li>
						))}
					</ul>
					<a href="#top" className="btn-secondary mt-8 w-full">
						{m.plan_cta_free()}
					</a>
				</Reveal>
				<Reveal
					delay={0.1}
					className="relative rounded-2xl border border-brand-500/50 bg-gradient-to-b from-brand-950/60 to-neutral-900 p-8 shadow-[0_0_50px_-15px_rgba(61,103,241,0.4)]"
				>
					<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
						{m.plan_badge_popular()}
					</span>
					<h3 className="font-semibold text-white">{m.plan_pro_name()}</h3>
					<div className="mt-3 flex items-baseline gap-1.5">
						<span className="font-display text-4xl font-bold text-white">
							{m.plan_pro_price()}
						</span>
						<span className="text-sm text-neutral-500">
							{m.plan_pro_period()}
						</span>
					</div>
					<p className="mt-3 text-sm text-neutral-400">{m.plan_pro_desc()}</p>
					<ul className="mt-6 space-y-2.5">
						{proFeatures.map((f) => (
							<li
								key={f}
								className="flex items-center gap-2.5 text-sm text-neutral-300"
							>
								<span className="text-brand-400">✓</span> {f}
							</li>
						))}
					</ul>
					<a href="#top" className="btn-primary mt-8 w-full">
						{m.plan_cta_pro()}
					</a>
				</Reveal>
			</div>
		</section>
	);
}

export function Testimonials() {
	const testimonials = [
		{
			text: m.testimonial_1_text(),
			name: m.testimonial_1_name(),
			role: m.testimonial_1_role(),
		},
		{
			text: m.testimonial_2_text(),
			name: m.testimonial_2_name(),
			role: m.testimonial_2_role(),
		},
		{
			text: m.testimonial_3_text(),
			name: m.testimonial_3_name(),
			role: m.testimonial_3_role(),
		},
	];
	return (
		<section className="border-y border-neutral-800/60 bg-neutral-900/40">
			<div className="mx-auto max-w-6xl px-6 py-24">
				<SectionHeading title={m.testimonials_title()} />
				<div className="mt-14 grid gap-5 md:grid-cols-3">
					{testimonials.map((t, i) => (
						<Reveal
							key={t.name}
							delay={i * 0.1}
							className="card flex flex-col p-6"
						>
							<div className="text-sm text-amber-400" aria-hidden>
								★★★★★
							</div>
							<blockquote className="mt-3 flex-1 text-sm leading-relaxed text-neutral-300">
								“{t.text}”
							</blockquote>
							<figcaption className="mt-5 flex items-center gap-3">
								<span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-300">
									{t.name.charAt(0)}
								</span>
								<div>
									<div className="text-sm font-medium text-white">{t.name}</div>
									<div className="text-xs text-neutral-500">{t.role}</div>
								</div>
							</figcaption>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function FinalCta() {
	return (
		<section className="relative mx-auto max-w-6xl overflow-hidden px-6 py-24">
			<Reveal className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-b from-brand-900/40 to-neutral-900 px-8 py-16 text-center">
				<div aria-hidden className="pointer-events-none absolute inset-0">
					<div className="absolute left-1/2 top-[-180px] h-[360px] w-[600px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[100px]" />
				</div>
				<div className="relative">
					<h2 className="section-title">{m.cta_title()}</h2>
					<p className="mx-auto mt-4 max-w-md text-neutral-400">
						{m.cta_subtitle()}
					</p>
					<a href="#top" className="btn-primary mt-8 px-7 py-3 text-base">
						{m.cta_button()}
					</a>
				</div>
			</Reveal>
		</section>
	);
}

export function Footer() {
	const cols: Array<[string, string[]]> = [
		[
			m.footer_product(),
			[m.nav_features(), m.nav_pricing(), m.nav_dashboard()],
		],
		[m.footer_company(), [m.footer_contact()]],
		[m.footer_legal(), [m.footer_privacy(), m.footer_terms()]],
	];
	return (
		<footer className="border-t border-neutral-800/60">
			<div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<div className="font-display text-lg font-bold tracking-tight text-white">
						resmio<span className="text-brand-400">.</span>
					</div>
					<p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
						{m.footer_tagline()}
					</p>
				</div>
				{cols.map(([heading, links]) => (
					<div key={heading}>
						<div className="text-sm font-semibold text-neutral-300">
							{heading}
						</div>
						<ul className="mt-4 space-y-2.5">
							{links.map((l) => (
								<li key={l}>
									<a
										href="#top"
										className="text-sm text-neutral-500 transition-colors hover:text-neutral-200"
									>
										{l}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
			<div className="border-t border-neutral-800/60 py-6 text-center text-xs text-neutral-600">
				{m.footer_rights({ year: new Date().getFullYear() })}
			</div>
		</footer>
	);
}
