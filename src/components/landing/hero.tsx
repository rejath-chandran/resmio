import { Link } from "@tanstack/react-router";

import { m } from "#/paraglide/messages";

// Animations are CSS keyframes (.reveal in styles.css), not framer-motion:
// motion elements start at opacity:0 and only animate after JS hydrates, which
// delayed the hero H1 (the LCP element) by ~1.5s on the landing page.
export function Hero() {
	return (
		<section className="relative overflow-hidden pt-36 pb-20">
			{/* Ambient background glow */}
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute left-1/2 top-[-320px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[140px]" />
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
			</div>

			<div className="relative mx-auto max-w-6xl px-6 text-center">
				<Reveal>
					<span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300">
						<span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
						{m.hero_badge()}
					</span>
				</Reveal>

				{/* No reveal animation on the H1: it is the LCP element — any
				    opacity/transform animation postpones its paint. */}
				<h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl">
					{m.hero_title_1()}{" "}
					<span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
						{m.hero_title_highlight()}
					</span>
				</h1>

				<Reveal delay={0.16}>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-400">
						{m.hero_subtitle()}
					</p>
				</Reveal>

				<Reveal delay={0.24}>
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Link
							to="/signup"
							search={{ redirect: "/" }}
							className="btn-primary px-7 py-3 text-base"
						>
							{m.hero_cta_primary()}
						</Link>
						<a href="#how" className="btn-secondary px-7 py-3 text-base">
							{m.hero_cta_secondary()}
						</a>
					</div>
				</Reveal>

				<Reveal delay={0.3}>
					<p className="mt-4 text-xs text-neutral-500">{m.hero_no_card()}</p>
				</Reveal>

				<Reveal delay={0.36}>
					<div className="mt-16">
						<ProductMock />
					</div>
				</Reveal>
			</div>
		</section>
	);
}

/** CSS-only fade-up reveal; replaces the old framer-motion fadeUp variant. */
function Reveal({
	delay = 0,
	children,
}: {
	delay?: number;
	children: React.ReactNode;
}) {
	return (
		<div
			className="reveal"
			style={delay ? { animationDelay: `${delay}s` } : undefined}
		>
			{children}
		</div>
	);
}

/** Static mini resume preview in a browser chrome frame. */
function ProductMock() {
	return (
		<div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
			<div className="flex items-center gap-1.5 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
				<span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
				<span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
				<span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
				<span className="ml-3 rounded-md bg-neutral-800 px-3 py-1 text-[11px] text-neutral-500">
					app.resmio.io/dashboard
				</span>
			</div>
			<div className="grid grid-cols-[1fr_180px] gap-6 p-8 text-left sm:grid-cols-[1fr_240px]">
				<div className="space-y-4">
					<div className="h-3 w-40 rounded bg-neutral-700" />
					<div className="h-2 w-24 rounded bg-neutral-800" />
					<div className="space-y-1.5 pt-2">
						<div className="h-2 w-56 rounded bg-neutral-800" />
						<div className="h-2 w-52 rounded bg-neutral-800" />
						<div className="h-2 w-60 rounded bg-neutral-800" />
					</div>
					<div className="pt-2">
						<div className="mb-2 h-2 w-16 rounded bg-brand-500/60" />
						<div className="space-y-1.5">
							<div className="h-2 w-64 rounded bg-neutral-800" />
							<div className="h-2 w-48 rounded bg-neutral-800" />
						</div>
					</div>
					<div className="pt-2">
						<div className="mb-2 h-2 w-14 rounded bg-brand-500/60" />
						<div className="space-y-1.5">
							<div className="h-2 w-52 rounded bg-neutral-800" />
							<div className="h-2 w-44 rounded bg-neutral-800" />
						</div>
					</div>
				</div>
				<div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
					<div className="flex items-center gap-2">
						<span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500/20 text-[11px] text-brand-300">
							✦
						</span>
						<div className="h-2 w-24 rounded bg-neutral-700" />
					</div>
					<div className="space-y-1.5">
						<div className="h-1.5 w-full rounded bg-neutral-800" />
						<div className="h-1.5 w-4/5 rounded bg-neutral-800" />
						<div className="h-1.5 w-3/5 rounded bg-neutral-800" />
					</div>
					<div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1.5 text-[10px] font-medium text-brand-300">
						{m.feature_ai_title()}
					</div>
				</div>
			</div>
		</div>
	);
}

export function HeroStats() {
	const stats: Array<[string, string]> = [
		["12k+", m.hero_stat_resumes()],
		["4.9/5", m.hero_stat_rating()],
		["6 min", m.hero_stat_speed()],
	];
	return (
		<div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-neutral-800/70 pt-8">
			{stats.map(([value, label]) => (
				<div key={label} className="text-center">
					<div className="font-display text-2xl font-bold text-white">
						{value}
					</div>
					<div className="mt-1 text-xs text-neutral-500">{label}</div>
				</div>
			))}
		</div>
	);
}
