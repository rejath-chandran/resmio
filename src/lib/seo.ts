export const SITE_URL = "https://cvatsfriendly.com";

export const LOCALE_TAGS = ["en", "de", "id"] as const;

const OG_IMAGE = `${SITE_URL}/og-image.png`;
const OG_IMAGE_ALT = "CVATSFriendly — build a free ATS friendly CV with AI";

/**
 * Robots + hreflang link set for public pages.
 * Spread into a route's `head()` meta/links. Pages without this default to
 * index,follow anyway — the tags make intent explicit and enable hreflang
 * clustering. Hreflang targets Paraglide's URL-rewritten /{locale} URLs.
 */
export function robotsMeta(): Array<Record<string, string>> {
	return [
		{ name: "robots", content: "index, follow, max-image-preview:large" },
	];
}

export function hreflangLinks(
	path = "",
): Array<{ rel: string; href: string; hreflang?: string }> {
	const links: Array<{ rel: string; href: string; hreflang?: string }> = [
		{ rel: "canonical", href: `${SITE_URL}${path}` },
	];
	for (const tag of LOCALE_TAGS) {
		links.push({
			rel: "alternate",
			hreflang: tag,
			href: `${SITE_URL}/${tag}${path}`,
		});
	}
	// x-default for search engines to pick for unmatched locales
	links.push({
		rel: "alternate",
		hreflang: "x-default",
		href: `${SITE_URL}${path}`,
	});
	return links;
}

/**
 * Complete Open Graph + Twitter card set. Covers what social crawlers need:
 * og:title/description/url/image(+dims,alt)/type/site_name and the Twitter
 * equivalents (summary_large_image card). Missing og:url/image/width/height
 * or twitter:card is what "incomplete Open Graph" checkers flag.
 */
export function ogMeta(opts: {
	title: string;
	description: string;
	path?: string;
	type?: "website" | "article";
}): Array<Record<string, string>> {
	const { title, description, path = "", type = "website" } = opts;
	return [
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: `${SITE_URL}${path}` },
		{ property: "og:type", content: type },
		{ property: "og:site_name", content: "CVATSFriendly" },
		{ property: "og:image", content: OG_IMAGE },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ property: "og:image:alt", content: OG_IMAGE_ALT },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: OG_IMAGE },
		{ name: "twitter:image:alt", content: OG_IMAGE_ALT },
	];
}
