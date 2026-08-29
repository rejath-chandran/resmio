import type { ResumeData } from "#/lib/resume-schema";

/**
 * ATS scorer — a pure, client-safe heuristic (no db/server imports) so the builder
 * can score the resume live on every keystroke and the server fn can reuse it.
 *
 * ponytail: this is a rubric, not a real ATS parser. Weights live in RUBRIC below so
 * they're easy to tune; upgrade path is a real parse/embedding model behind atsReview.
 */

export type AtsCategory = {
	key: string;
	label: string;
	score: number;
	max: number;
};

export type AtsReport = {
	score: number; // 0..100
	categories: AtsCategory[];
	suggestions: string[];
	missingKeywords: string[];
};

const ACTION_VERB =
	/^(led|built|developed|designed|created|launched|shipped|owned|drove|improved|increased|reduced|delivered|managed|implemented|architected|automated|optimized|scaled|migrated|introduced|established|streamlined|spearheaded|executed|supported)\b/i;

const STOPWORDS = new Set(
	"the a an and or but for to of in on at by with from as is are be we you our your their them they this that will can should must have has had who whom which what when where why how not no all any into over under more most other such only own same than too very just also team teams work working role roles job jobs experience years year strong ability able".split(
		" ",
	),
);

const HAS_NUMBER = /\d|%/;

const clamp = (n: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, n));

/** Lowercased word tokens ≥3 chars, stopwords dropped. */
function tokens(text: string): string[] {
	return (text.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? []).filter(
		(w) => !STOPWORDS.has(w),
	);
}

/** Flattens the resume into one searchable text blob (also used for the AI review). */
export function resumeToText(d: ResumeData): string {
	return [
		d.basics.fullName,
		d.basics.summary,
		...d.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
		...d.education.map((e) => `${e.degree} ${e.school}`),
		...d.projects.map((p) => `${p.name} ${p.description}`),
		...d.skills,
	]
		.filter(Boolean)
		.join(" ");
}

/**
 * Scores the resume 0–100 across weighted categories and emits one concrete
 * suggestion per category that falls short. `jobDescription` (optional) drives the
 * keyword category; when absent that category is awarded in full so the base score
 * stays meaningful.
 */
export function computeAtsReport(
	d: ResumeData,
	jobDescription?: string,
): AtsReport {
	const cats: AtsCategory[] = [];
	const suggestions: string[] = [];
	const add = (
		key: string,
		label: string,
		score: number,
		max: number,
		hint?: string,
	) => {
		cats.push({ key, label, score: clamp(Math.round(score), 0, max), max });
		if (score < max && hint) suggestions.push(hint);
	};

	// Contact (15): email + phone + location, 5 each.
	const contact =
		(d.basics.email ? 5 : 0) +
		(d.basics.phone ? 5 : 0) +
		(d.basics.location ? 5 : 0);
	add(
		"contact",
		"Contact details",
		contact,
		15,
		"Add your email, phone and location — ATS parsers key on all three.",
	);

	// Summary (10): present and 250–600 chars.
	const len = d.basics.summary.trim().length;
	const summary = len === 0 ? 0 : len < 250 ? 5 : len <= 600 ? 10 : 7;
	add(
		"summary",
		"Professional summary",
		summary,
		10,
		len === 0
			? "Add a 2–3 sentence professional summary near the top."
			: "Aim for a 250–600 character summary — concise but keyword-rich.",
	);

	// Experience (15): entries complete with role/company/dates.
	const exp = d.experience;
	const complete = exp.filter(
		(e) => e.role && e.company && e.start && (e.current || e.end),
	).length;
	const experience =
		exp.length === 0 ? 0 : 7 + clamp((complete / exp.length) * 8, 0, 8);
	add(
		"experience",
		"Work experience",
		experience,
		15,
		exp.length === 0
			? "Add at least one work experience entry."
			: "Fill role, company and dates on every experience entry.",
	);

	// Bullets (20): quantified + action-verb openers.
	const bullets = exp.flatMap((e) => e.bullets).filter(Boolean);
	const quantified = bullets.filter((b) => HAS_NUMBER.test(b)).length;
	const strong = bullets.filter((b) => ACTION_VERB.test(b.trim())).length;
	const bulletScore =
		bullets.length === 0
			? 0
			: clamp((quantified / bullets.length) * 12, 0, 12) +
				clamp((strong / bullets.length) * 8, 0, 8);
	add(
		"bullets",
		"Impactful bullets",
		bulletScore,
		20,
		bullets.length === 0
			? "Add achievement bullets under your experience."
			: `Quantify more bullets (${quantified}/${bullets.length} have numbers) and open with action verbs (${strong}/${bullets.length}).`,
	);

	// Skills (10): 5–15 is the sweet spot.
	const sk = d.skills.length;
	const skills = sk === 0 ? 0 : sk < 5 ? sk : sk <= 15 ? 10 : 8;
	add(
		"skills",
		"Skills",
		skills,
		10,
		sk < 5
			? "List at least 5 relevant skills."
			: "Keep skills focused (5–15) and relevant to the target role.",
	);

	// Education (5) + Links (5).
	add(
		"education",
		"Education",
		d.education.length > 0 ? 5 : 0,
		5,
		"Add an education entry.",
	);
	add(
		"links",
		"Links",
		d.links.length > 0 ? 5 : 0,
		5,
		"Add a portfolio, GitHub or LinkedIn link.",
	);

	// Formatting sanity (10): name set, bullets not bloated, no empty sections.
	const longBullets = bullets.filter((b) => b.length > 240).length;
	const formatting =
		(d.basics.fullName ? 4 : 0) +
		(longBullets === 0 ? 3 : 0) +
		(exp.length > 0 && d.skills.length > 0 ? 3 : 0);
	add(
		"formatting",
		"Formatting",
		formatting,
		10,
		!d.basics.fullName
			? "Add your full name."
			: longBullets > 0
				? "Shorten overly long bullets — one line each parses cleanest."
				: "Fill out both experience and skills sections.",
	);

	// Keywords (10): overlap with the target job description.
	const missingKeywords: string[] = [];
	let keywordScore = 10;
	const jd = (jobDescription ?? "").trim();
	if (jd) {
		const have = new Set(tokens(resumeToText(d)));
		const wanted = [...new Set(tokens(jd))];
		const top = wanted.slice(0, 40);
		const matched = top.filter((w) => have.has(w));
		keywordScore = top.length === 0 ? 10 : (matched.length / top.length) * 10;
		for (const w of top) {
			if (!have.has(w) && missingKeywords.length < 12) missingKeywords.push(w);
		}
		add(
			"keywords",
			"Keyword match",
			keywordScore,
			10,
			missingKeywords.length > 0
				? `Weave in missing keywords: ${missingKeywords.slice(0, 6).join(", ")}.`
				: undefined,
		);
	} else {
		add("keywords", "Keyword match", 10, 10);
	}

	const score = clamp(
		Math.round(cats.reduce((s, c) => s + c.score, 0)),
		0,
		100,
	);
	return { score, categories: cats, suggestions, missingKeywords };
}

/** Band for colouring the score. */
export function atsBand(score: number): "low" | "mid" | "high" {
	return score < 50 ? "low" : score < 80 ? "mid" : "high";
}
