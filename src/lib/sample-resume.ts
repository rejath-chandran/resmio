import type { ResumeData } from "#/lib/resume-schema";

/**
 * Filler resume for the admin template preview. Fabricated details only —
 * a real user's resume must never render on an admin screen.
 */
export const SAMPLE_RESUME: ResumeData = {
	basics: {
		fullName: "Alex Example",
		email: "alex@example.com",
		phone: "+49 30 1234567",
		location: "Berlin, DE",
		website: "example.com",
		summary:
			"Product engineer with eight years building data-heavy web apps. Leads small teams, ships weekly, and writes the docs nobody else wants to.",
	},
	experience: [
		{
			id: "s1",
			company: "Northwind Labs",
			role: "Senior Engineer",
			start: "2022",
			end: "",
			current: true,
			bullets: [
				"Cut median page load from 3.1s to 780ms by moving rendering to the edge.",
				"Led the migration of 40 services off a shared database.",
			],
		},
		{
			id: "s2",
			company: "Kestrel GmbH",
			role: "Full-stack Developer",
			start: "2019",
			end: "2022",
			current: false,
			bullets: [
				"Built the billing pipeline handling €4M in annual volume.",
				"Introduced end-to-end tests, dropping release rollbacks by 60%.",
			],
		},
	],
	education: [
		{
			id: "e1",
			school: "TU Berlin",
			degree: "M.Sc. Computer Science",
			start: "2015",
			end: "2018",
		},
	],
	projects: [
		{
			id: "p1",
			name: "Edge Renderer",
			url: "github.com/alex/edge-renderer",
			description:
				"Open-source SSR toolkit adopted by 300+ repos; ships HTML from the nearest edge node.",
		},
	],
	links: [
		{ id: "l1", label: "GitHub", url: "github.com/alex" },
		{ id: "l2", label: "LinkedIn", url: "linkedin.com/in/alex" },
	],
	skills: [
		"TypeScript",
		"React",
		"PostgreSQL",
		"Go",
		"Terraform",
		"Playwright",
	],
};
