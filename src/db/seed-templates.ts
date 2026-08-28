import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const { db } = await import("./index.ts");
const { templates } = await import("./schema.ts");

/**
 * Built-in templates. Ids match the layout ids and the values already stored in
 * `resumes.template`, so seeding needs no data migration.
 *
 * Re-runnable: `onConflictDoNothing` leaves admin edits to a seeded row alone.
 * ponytail: seeds are the only way built-ins reach a fresh DB — fold into a
 * migration if this ever needs to run as part of a deploy pipeline.
 */
const BUILT_INS = [
	{
		id: "modern",
		name: "Modern",
		description:
			"Two-column with a tinted sidebar. Safe default for most roles.",
		layout: "modern",
		theme: {
			accent: "#3d67f1",
			ink: "#111827",
			font: "sans",
			density: "normal",
		},
		sortOrder: 10,
	},
	{
		id: "classic",
		name: "Classic",
		description: "Serif single column with ruled headings. Reads formal.",
		layout: "classic",
		theme: {
			accent: "#1f2937",
			ink: "#111827",
			font: "serif",
			density: "normal",
		},
		sortOrder: 20,
	},
	{
		id: "minimal",
		name: "Minimal",
		description: "Quiet single column, maximum whitespace.",
		layout: "minimal",
		theme: { accent: "#374151", ink: "#1f2937", font: "sans", density: "airy" },
		sortOrder: 30,
	},
	{
		id: "sidebar",
		name: "Sidebar",
		description: "Dark contact rail against a light body. High contrast.",
		layout: "sidebar",
		theme: {
			accent: "#0f766e",
			ink: "#111827",
			font: "sans",
			density: "normal",
		},
		sortOrder: 40,
	},
	{
		id: "timeline",
		name: "Timeline",
		description: "Vertical rule with a date gutter. Shows career progression.",
		layout: "timeline",
		theme: {
			accent: "#b45309",
			ink: "#1f2937",
			font: "sans",
			density: "normal",
		},
		sortOrder: 50,
	},
	{
		id: "swiss",
		name: "Swiss",
		description: "Heavy type, geometric blocks, tight grid. Design-forward.",
		layout: "swiss",
		theme: {
			accent: "#dc2626",
			ink: "#111827",
			font: "sans",
			density: "tight",
		},
		sortOrder: 60,
	},
	{
		id: "elegant",
		name: "Elegant",
		description: "Centered serif header with hairline rules. Understated.",
		layout: "elegant",
		theme: {
			accent: "#7c3aed",
			ink: "#1f2937",
			font: "serif",
			density: "airy",
		},
		sortOrder: 70,
	},
	{
		id: "editorial",
		name: "Editorial",
		description: "Two-tone header band over a wide body. Magazine feel.",
		layout: "editorial",
		theme: {
			accent: "#0369a1",
			ink: "#111827",
			font: "sans",
			density: "normal",
		},
		sortOrder: 80,
	},
];

const rows = await db
	.insert(templates)
	.values(BUILT_INS.map((t) => ({ ...t, theme: JSON.stringify(t.theme) })))
	.onConflictDoNothing()
	.returning({ id: templates.id });

console.log(
	`seeded ${rows.length} of ${BUILT_INS.length} templates${
		rows.length
			? `: ${rows.map((r) => r.id).join(", ")}`
			: " (all already present)"
	}`,
);
