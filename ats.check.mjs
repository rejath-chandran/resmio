import assert from "node:assert/strict";

// Self-check for the pure ATS scorer. Run: npx tsx ./ats.check.mjs
const { computeAtsReport, atsBand } = await import("./src/lib/ats.ts");

const empty = {
	basics: { fullName: "", email: "", phone: "", location: "", website: "", summary: "" },
	experience: [],
	education: [],
	projects: [],
	links: [],
	skills: [],
};

const full = {
	basics: {
		fullName: "Alex Example",
		email: "alex@example.com",
		phone: "+49 30 123",
		location: "Berlin",
		website: "alex.dev",
		summary:
			"Senior product engineer with eight years shipping data-heavy web apps. Leads small teams, ships weekly, and owns reliability. Focused on measurable impact and clean systems that scale.",
	},
	experience: [
		{
			id: "1",
			company: "Northwind",
			role: "Senior Engineer",
			start: "2022",
			end: "",
			current: true,
			bullets: [
				"Reduced median page load from 3.1s to 780ms across 12 services.",
				"Led a team of 5 to migrate 40 services off a shared database.",
			],
		},
	],
	education: [{ id: "e", school: "TU Berlin", degree: "MSc CS", start: "2015", end: "2018" }],
	projects: [{ id: "p", name: "Edge Renderer", url: "gh/x", description: "SSR toolkit." }],
	links: [{ id: "l", label: "GitHub", url: "github.com/alex" }],
	skills: ["TypeScript", "React", "PostgreSQL", "Go", "Terraform", "Playwright"],
};

const lo = computeAtsReport(empty);
const hi = computeAtsReport(full);

// Score bounds + clamping.
assert.ok(lo.score >= 0 && lo.score <= 100, "low score in range");
assert.ok(hi.score >= 0 && hi.score <= 100, "high score in range");
assert.ok(lo.score < 30, `empty resume scores low, got ${lo.score}`);
assert.ok(hi.score > 80, `complete resume scores high, got ${hi.score}`);
assert.ok(hi.score > lo.score, "complete beats empty");

// Categories present and each clamped to its max.
assert.equal(hi.categories.length, 9, "nine categories");
for (const c of hi.categories) {
	assert.ok(c.score >= 0 && c.score <= c.max, `${c.key} within [0,max]`);
	assert.equal(hi.score >= 0, true);
}

// Suggestions only fire for sub-max categories.
assert.ok(lo.suggestions.length > 0, "empty resume yields suggestions");
const empties = lo.categories.filter((c) => c.score < c.max).length;
assert.ok(lo.suggestions.length <= empties, "no suggestion for maxed categories");

// Keyword category responds to a matching job description.
const noJd = computeAtsReport(full).categories.find((c) => c.key === "keywords").score;
const matchJd = computeAtsReport(full, "Looking for a TypeScript React PostgreSQL engineer to lead reliability.").categories.find(
	(c) => c.key === "keywords",
).score;
const missJd = computeAtsReport(full, "Seeking a Rust kernel driver embedded firmware specialist welding pipelines.");
assert.equal(noJd, 10, "no JD → full keyword credit");
assert.ok(matchJd >= missJd.categories.find((c) => c.key === "keywords").score, "matching JD scores >= mismatched");
assert.ok(missJd.missingKeywords.length > 0, "mismatched JD lists missing keywords");

// Band helper.
assert.equal(atsBand(20), "low");
assert.equal(atsBand(65), "mid");
assert.equal(atsBand(90), "high");

console.log(`PASS ats.check — empty=${lo.score} full=${hi.score} matchKw=${matchJd} missKw=${missJd.categories.find((c) => c.key === "keywords").score}`);
