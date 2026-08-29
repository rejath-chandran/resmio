/**
 * Resume data model — stored as JSON in the `resumes.data` column.
 * ponytail: hand-rolled validation instead of zod; swap for zod when
 * the model grows past ~10 fields or validation needs composability.
 */

export type ResumeData = {
	basics: {
		fullName: string;
		email: string;
		phone: string;
		location: string;
		website: string;
		summary: string;
	};
	experience: Array<{
		id: string;
		company: string;
		role: string;
		start: string;
		end: string;
		current: boolean;
		bullets: string[];
	}>;
	education: Array<{
		id: string;
		school: string;
		degree: string;
		start: string;
		end: string;
	}>;
	projects: Array<{
		id: string;
		name: string;
		url: string;
		description: string;
	}>;
	links: Array<{
		id: string;
		label: string;
		url: string;
	}>;
	skills: string[];
};

export const emptyResume = (): ResumeData => ({
	basics: {
		fullName: "",
		email: "",
		phone: "",
		location: "",
		website: "",
		summary: "",
	},
	experience: [],
	education: [],
	projects: [],
	links: [],
	skills: [],
});

const str = (v: unknown, max = 200): string =>
	typeof v === "string" ? v.slice(0, max) : "";

function parseExperience(v: unknown): ResumeData["experience"] {
	if (!Array.isArray(v)) return [];
	return v.slice(0, 30).map((e) => {
		const o = (e ?? {}) as Record<string, unknown>;
		return {
			id: str(o.id, 40) || crypto.randomUUID(),
			company: str(o.company, 120),
			role: str(o.role, 120),
			start: str(o.start, 20),
			end: str(o.end, 20),
			current: o.current === true,
			bullets: Array.isArray(o.bullets)
				? o.bullets
						.slice(0, 10)
						.map((b) => str(b, 400))
						.filter(Boolean)
				: [],
		};
	});
}

function parseEducation(v: unknown): ResumeData["education"] {
	if (!Array.isArray(v)) return [];
	return v.slice(0, 15).map((e) => {
		const o = (e ?? {}) as Record<string, unknown>;
		return {
			id: str(o.id, 40) || crypto.randomUUID(),
			school: str(o.school, 120),
			degree: str(o.degree, 120),
			start: str(o.start, 20),
			end: str(o.end, 20),
		};
	});
}

function parseProjects(v: unknown): ResumeData["projects"] {
	if (!Array.isArray(v)) return [];
	return v.slice(0, 20).map((e) => {
		const o = (e ?? {}) as Record<string, unknown>;
		return {
			id: str(o.id, 40) || crypto.randomUUID(),
			name: str(o.name, 120),
			url: str(o.url, 200),
			description: str(o.description, 600),
		};
	});
}

function parseLinks(v: unknown): ResumeData["links"] {
	if (!Array.isArray(v)) return [];
	return v.slice(0, 15).map((e) => {
		const o = (e ?? {}) as Record<string, unknown>;
		return {
			id: str(o.id, 40) || crypto.randomUUID(),
			label: str(o.label, 60),
			url: str(o.url, 200),
		};
	});
}

export function parseResumeData(v: unknown): ResumeData {
	const o = (v ?? {}) as Record<string, unknown>;
	const b = (o.basics ?? {}) as Record<string, unknown>;
	return {
		basics: {
			fullName: str(b.fullName, 80),
			email: str(b.email, 120),
			phone: str(b.phone, 40),
			location: str(b.location, 80),
			website: str(b.website, 200),
			summary: str(b.summary, 1200),
		},
		experience: parseExperience(o.experience),
		education: parseEducation(o.education),
		projects: parseProjects(o.projects),
		links: parseLinks(o.links),
		skills: Array.isArray(o.skills)
			? o.skills
					.slice(0, 30)
					.map((s) => str(s, 50))
					.filter(Boolean)
			: [],
	};
}
