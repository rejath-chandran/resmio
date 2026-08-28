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
import { getSession } from "#/lib/auth-functions";

export const Route = createFileRoute("/")({
	loader: () => getSession(),
	head: () => ({
		meta: [
			{ title: "Resmio — AI Resume Builder" },
			{
				name: "description",
				content:
					"Resmio uses AI to turn your experience into sharp, recruiter-ready resumes. Build, refine and export in minutes.",
			},
			{ property: "og:title", content: "Resmio — AI Resume Builder" },
			{ property: "og:type", content: "website" },
		],
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
				<FinalCta />
			</main>
			<Footer />
		</div>
	);
}
