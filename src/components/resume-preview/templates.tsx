import { LAYOUTS } from "#/components/resume-preview/layouts";
import type { ResumeData } from "#/lib/resume-schema";
import { DEFAULT_THEME, type TemplateTheme, themeVars } from "#/lib/templates";

/**
 * Resolves a template (layout id + theme) to a rendered A4 sheet.
 *
 * The theme lands as inline CSS custom properties, which survive the
 * `outerHTML` clone in src/lib/pdf-export.ts — that is why layouts read
 * var(--t-accent) instead of Tailwind colour classes.
 */
export function ResumeSheet({
	data,
	layout,
	theme = DEFAULT_THEME,
	presentLabel,
}: {
	data: ResumeData;
	layout: string;
	theme?: TemplateTheme;
	presentLabel: string;
}) {
	// Unknown layout (template deleted mid-session, or a row from a newer deploy)
	// still renders — falling back beats an empty sheet.
	const Layout = LAYOUTS[layout as keyof typeof LAYOUTS] ?? LAYOUTS.modern;
	return (
		<div
			className={`h-full ${theme.font === "serif" ? "font-serif" : "font-sans"}`}
			style={{ ...themeVars(theme), color: "var(--t-ink)" }}
		>
			<Layout data={data} theme={theme} presentLabel={presentLabel} />
		</div>
	);
}
