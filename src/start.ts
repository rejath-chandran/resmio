import { createMiddleware, createStart } from "@tanstack/react-start";
import { paraglideMiddleware } from "#/paraglide/server";

/** Server request middleware: paraglide locale detection (/de URLs handled by router `rewrite`). */
const paraglide = createMiddleware().server(({ next, request }) =>
	paraglideMiddleware(request, () => next()),
);

export const startInstance = createStart(() => ({
	requestMiddleware: [paraglide],
}));
