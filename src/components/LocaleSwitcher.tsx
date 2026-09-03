// Locale switcher refs:
// - Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
// - Router example: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#switching-locale
import { getLocale, locales, setLocale } from "#/paraglide/runtime";

const LOCALE_LABELS: Record<string, string> = {
	en: "English",
	de: "Deutsch",
	id: "Bahasa",
};

export default function LocaleSwitcher() {
	const currentLocale = getLocale();

	return (
		<div className="relative">
			<span
				aria-hidden
				className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
			>
				<svg aria-hidden="true"
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
				</svg>
			</span>
			<label htmlFor="locale-select" className="sr-only">
				Language
			</label>
			<select
				id="locale-select"
				value={currentLocale}
				aria-label="Language"
				onChange={(e) => setLocale(e.target.value as (typeof locales)[number])}
				className="w-[112px] cursor-pointer appearance-none truncate rounded-full border border-neutral-700/80 bg-neutral-900 py-1.5 pl-8 pr-7 text-xs font-semibold text-neutral-200 transition-colors hover:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-400"
			>
				{locales.map((locale) => (
					<option
						key={locale}
						value={locale}
						className="bg-neutral-900 text-neutral-200"
					>
						{LOCALE_LABELS[locale] ?? locale.toUpperCase()}
					</option>
				))}
			</select>
			<span
				aria-hidden
				className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
			>
				<svg aria-hidden="true"
					width="10"
					height="10"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</span>
		</div>
	);
}
