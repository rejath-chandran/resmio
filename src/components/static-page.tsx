import { Link } from "@tanstack/react-router";

import { Nav } from "#/components/landing/nav";
import { Footer } from "#/components/landing/sections";
import { hreflangLinks, ogMeta, robotsMeta } from "#/lib/seo";

/** Shell for static marketing/legal pages. Each route renders PageContent inside. */
export function StaticShell({
	page,
	path,
	title,
	description,
	children,
}: {
	page: string;
	path: string;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-neutral-950" data-page={page}>
			<title>{title}</title>
			<meta name="description" content={description} />
			{robotsMeta().map((m) => (
				<meta key={m.name} name={m.name} content={m.content} />
			))}
			{ogMeta({ title, description, path }).map((m) =>
				m.property ? (
					<meta
						key={m.property}
						property={m.property}
						content={m.content}
					/>
				) : (
					<meta key={m.name} name={m.name} content={m.content} />
				),
			)}
			{hreflangLinks(path).map((l) => (
				<link
					key={`${l.rel}-${l.hreflang ?? "canonical"}`}
					rel={l.rel}
					hrefLang={l.hreflang}
					href={l.href}
				/>
			))}
			<Nav authed={false} />
			<main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
				<h1 className="font-display text-4xl font-bold tracking-tight text-white">
					{title}
				</h1>
				<div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-400">
					{children}
				</div>
				<Link
					to="/"
					className="mt-12 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200"
				>
					← Back to home
				</Link>
			</main>
			<Footer />
		</div>
	);
}
