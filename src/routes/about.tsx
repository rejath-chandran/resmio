import { createFileRoute } from "@tanstack/react-router";

import { StaticShell } from "#/components/static-page";

export const Route = createFileRoute("/about")({
	head: () => ({
		meta: [
			{ title: "About — CVATSFriendly" },
			{
				name: "description",
				content:
					"CVATSFriendly is the free AI CV builder that creates ATS friendly CVs — clean templates, real-time ATS scoring and one-click PDF export.",
			},
		],
	}),
	component: () => (
		<StaticShell
			page="about"
			path="/about"
			title="About CVATSFriendly"
			description="We build free, ATS friendly CV tools so great candidates stop getting filtered out by software."
		>
			<p>
				CVATSFriendly started from a simple frustration: great candidates were
				losing interviews not because of their experience, but because their CV
				couldn't survive an Applicant Tracking System. Hiring software parses
				every CV that arrives — and fragile layouts, tables and graphics get
				flattened into noise before a recruiter ever reads a word.
			</p>
			<p>
				So we built a CV builder where every template is ATS friendly by
				default. Clean single-column layouts, standard section headings,
				text-based PDF export, and a live ATS score that checks your CV against
				the job description you're targeting. The AI writing assistant sharpens
				your bullet points into quantified, keyword-rich achievements — in
				English, German and Bahasa Indonesia.
			</p>
			<p>
				Our promise: the free plan is genuinely free, your data belongs to you,
				and every export is a CV humans like reading and parsers can parse.
			</p>
		</StaticShell>
	),
});
