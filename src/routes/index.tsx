import { createFileRoute } from "@tanstack/react-router";

import { Hero, HeroStats } from "#/components/landing/hero";
import { Nav } from "#/components/landing/nav";
import {
	Features,
	FinalCta,
	Footer,
	HowItWorks,
	Pricing,
	Testimonials,
} from "#/components/landing/sections";
import { SeoContent, SeoJsonLd } from "#/components/landing/seo";
import { getSession } from "#/lib/auth-functions";
import { hreflangLinks, ogMeta, robotsMeta } from "#/lib/seo";

export const Route = createFileRoute("/")({
	loader: () => getSession(),
	head: () => ({
		meta: [
			{ title: "cvatsfriendly — CV ATS Friendly Builder" },
			{
				name: "description",
				content:
					"Build a free, ATS friendly CV with AI — recruiter-approved templates, a live ATS score against the job description and one-click PDF export that beats the bots.",
			},
			{
				name: "keywords",
				content:
					"cv ats friendly, ats friendly cv, ats friendly resume builder, ats resume checker, cv builder",
			},
			...ogMeta({
				title: "cvatsfriendly — CV ATS Friendly Builder",
				description:
					"Build a free, ATS friendly CV with AI — recruiter-approved templates, a live ATS score against the job description and one-click PDF export that beats the bots.",
			}),
			...robotsMeta(),
		],
		links: hreflangLinks(),
	}),
	component: LandingPage,
});

function LandingPage() {
	const session = Route.useLoaderData();
	return (
		<div id="top" className="min-h-screen bg-neutral-950">
			<Nav authed={Boolean(session)} />
			<main>
				<Hero />
				<HeroStats />
				<Features />
				<HowItWorks />
				<Pricing />
				<Testimonials />
				<SeoContent />
				<FinalCta />
			</main>
			<Footer />
			<SeoJsonLd url="https://cvatsfriendly.com" />
		</div>
	);
}
