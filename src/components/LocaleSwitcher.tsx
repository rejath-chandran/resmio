// Locale switcher refs:
// - Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
// - Router example: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#switching-locale
import { getLocale, locales, setLocale } from "#/paraglide/runtime";

export default function LocaleSwitcher() {
	const currentLocale = getLocale();

	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: plain div, label is advisory
		<div className="flex items-center gap-1" aria-label="Language">
			{locales.map((locale) => (
				<button
					key={locale}
					type="button"
					onClick={() => setLocale(locale)}
					aria-pressed={locale === currentLocale}
					className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors ${
						locale === currentLocale
							? "bg-neutral-700 text-white"
							: "text-neutral-400 hover:text-neutral-100"
					}`}
				>
					{locale.toUpperCase()}
				</button>
			))}
		</div>
	);
}
