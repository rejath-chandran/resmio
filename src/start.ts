import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/start-server-core/request-response";
import { paraglideMiddleware } from "#/paraglide/server";

/** Server request middleware: paraglide locale detection (/de URLs handled by router `rewrite`). */
const paraglide = createMiddleware().server(({ next, request }) =>
	paraglideMiddleware(request, () => next()),
);

/**
 * SEO: X-Robots-Tag on every document response. Auth-only areas must never be
 * indexed; public pages get the default (absent header = indexable).
 */
const robotsHeader = createMiddleware().server(({ next, request }) => {
	const res = next();
	if (!new URL(request.url).pathname.startsWith("/dashboard")) {
		setResponseHeader("X-Robots-Tag", "index, follow");
	}
	return res;
});

export const startInstance = createStart(() => ({
	requestMiddleware: [paraglide, robotsHeader],
}));
