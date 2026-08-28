/**
 * Template theming. A template row = a layout engine id (code) + this theme (data),
 * so admins can create new templates without a deploy.
 *
 * ponytail: hand-rolled validation to match src/lib/resume-schema.ts; swap both for
 * zod together if the model grows.
 */

export type TemplateTheme = {
	/** Accent colour, used for rules, headings and blocks. */
	accent: string;
	/** Body text colour. */
	ink: string;
	font: "sans" | "serif";
	density: "tight" | "normal" | "airy";
};

export const DEFAULT_THEME: TemplateTheme = {
	accent: "#3d67f1",
	ink: "#111827",
	font: "sans",
	density: "normal",
};

/** Section gap in px per density — layouts read this via the --t-gap CSS var. */
const GAP = { tight: 10, normal: 16, airy: 24 } as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

const hex = (v: unknown, fallback: string) =>
	typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback;

export function parseTheme(v: unknown): TemplateTheme {
	const o = (v ?? {}) as Record<string, unknown>;
	return {
		accent: hex(o.accent, DEFAULT_THEME.accent),
		ink: hex(o.ink, DEFAULT_THEME.ink),
		font: o.font === "serif" ? "serif" : "sans",
		density:
			o.density === "tight" || o.density === "airy" ? o.density : "normal",
	};
}

/**
 * Theme → inline CSS custom properties. Inline styles survive the `outerHTML`
 * clone in src/lib/pdf-export.ts, and Tailwind can't compile dynamic colours,
 * so layouts reference these vars via arbitrary values: text-[var(--t-accent)].
 */
export function themeVars(theme: TemplateTheme): React.CSSProperties {
	return {
		"--t-accent": theme.accent,
		"--t-ink": theme.ink,
		"--t-gap": `${GAP[theme.density]}px`,
	} as React.CSSProperties;
}

/** Template ids are URL/slug-safe so they can sit in a route param. */
export const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

export const isSlug = (v: unknown): v is string =>
	typeof v === "string" && SLUG.test(v);
