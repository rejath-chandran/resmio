import { Link } from "@tanstack/react-router";

import { Reveal, SectionHeading } from "#/components/landing/sections";

const FAQS: Array<{ q: string; a: string }> = [
	{
		q: "What does “CV ATS friendly” mean?",
		a: "An ATS (Applicant Tracking System) is the software companies use to screen resumes before a human sees them. A CV that is ATS friendly uses a clean single-column layout, standard section headings, no tables or text boxes, and readable fonts — so the parser extracts every detail correctly. CVATSFriendly builds every CV this way by default.",
	},
	{
		q: "How do I make my CV ATS friendly?",
		a: "Use a simple layout with standard headings (Experience, Education, Skills), mirror keywords from the job description, avoid graphics, tables and columns, and submit as a text-based PDF. Our free builder enforces all of these rules automatically and scores your CV against the job description in real time.",
	},
	{
		q: "Is CVATSFriendly really free?",
		a: "Yes. Create your account, pick any ATS-friendly template, write with the AI assistant and export a PDF — all on the free plan. Pro adds the live ATS score checker, priority AI and unlimited versions.",
	},
	{
		q: "Does an ATS friendly CV still look good?",
		a: "Yes — clean is not boring. Our recruiter-approved templates are minimal, modern and typographically sharp, and they pass every major ATS. You get both: a CV humans like and parsers can read.",
	},
];

/** Keyword-rich long-form SEO section + FAQ (FAQPage schema) appended to the landing page. */
export function SeoContent() {
	return (
		<section className="border-t border-neutral-800/60 bg-neutral-900/40">
			<div className="mx-auto max-w-4xl px-6 py-24">
				<SectionHeading
					title="Build a CV ATS friendly enough to beat the robots"
					subtitle="75% of resumes are rejected by ATS software before a recruiter ever reads them. Every CV you build here is ATS friendly by design."
				/>

				<Reveal className="mt-14 space-y-10 text-sm leading-relaxed text-neutral-400">
					<div>
						<h3 className="text-base font-semibold text-white">
							Why you need an ATS friendly CV
						</h3>
						<p className="mt-2">
							Most mid-to-large companies filter applications with an Applicant
							Tracking System. If your CV layout confuses the parser — fancy
							columns, icons, tables, headers/footers with contact details —
							your experience may never reach the recruiter. A CV ATS friendly
							in structure guarantees your skills and titles are extracted
							exactly as you wrote them.
						</p>
					</div>
					<div>
						<h3 className="text-base font-semibold text-white">
							What makes our CV builder ATS friendly
						</h3>
						<ul className="mt-2 list-inside list-disc space-y-1.5">
							<li>
								Single-column, parser-safe templates tested against real ATS
								pipelines
							</li>
							<li>
								Standard section headings ATS software recognizes instantly
							</li>
							<li>
								Real-time ATS score that checks keyword match against the job
								description
							</li>
							<li>
								AI rewrites that naturally weave in job-description keywords
							</li>
							<li>
								Clean text-based PDF export — no invisible text, no parsing
								errors
							</li>
						</ul>
					</div>
					<div>
						<h3 className="text-base font-semibold text-white">
							Free ATS friendly CV templates
						</h3>
						<p className="mt-2">
							Start from a proven ATS friendly CV template, fill in your story,
							let the AI sharpen every bullet, and download a polished PDF in
							minutes. English, German and Bahasa Indonesia supported — because
							ATS screening exists in every job market.
						</p>
					</div>
				</Reveal>

				<Reveal className="mt-20">
					<h3 className="text-center font-display text-2xl font-bold text-white">
						Frequently asked questions
					</h3>
					<div className="mt-8 space-y-4">
						{FAQS.map((f) => (
							<details
								key={f.q}
								className="card group p-5 [&_summary::-webkit-details-marker]:hidden"
							>
								<summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
									{f.q}
								</summary>
								<p className="mt-3 text-sm leading-relaxed text-neutral-400">
									{f.a}
								</p>
							</details>
						))}
					</div>
				</Reveal>

				<Reveal className="mt-12 text-center">
					<Link
						to="/signup"
						search={{ redirect: "/" }}
						className="btn-primary px-7 py-3 text-base"
					>
						Create your free ATS friendly CV
					</Link>
				</Reveal>
			</div>
		</section>
	);
}

/** JSON-LD FAQPage + WebApplication schema for rich results. */
export function SeoJsonLd({ url }: { url: string }) {
	const data = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "FAQPage",
				mainEntity: FAQS.map((f) => ({
					"@type": "Question",
					name: f.q,
					acceptedAnswer: { "@type": "Answer", text: f.a },
				})),
			},
			{
				"@type": "WebApplication",
				name: "CVATSFriendly",
				applicationCategory: "BusinessApplication",
				operatingSystem: "Web",
				url,
				description:
					"Free AI CV builder that creates ATS friendly CVs with real-time ATS score checking and one-click PDF export.",
				offers: [
					{ "@type": "Offer", price: "0", priceCurrency: "USD" },
					{ "@type": "Offer", price: "9", priceCurrency: "USD" },
				],
			},
		],
	};
	return (
		<script
			type="application/ld+json"
			// JSON.stringify output is safe to embed; HTML-special chars are escaped.
			// biome-ignore lint/suspicious/noDangerouslySetInnerHtml: JSON-LD must be raw script content
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, "\\u003c"),
			}}
		/>
	);
}
