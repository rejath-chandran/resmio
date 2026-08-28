import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";

import { auth } from "#/lib/auth";

/**
 * Server-function middleware: enforces an authenticated session.
 * Route guards (beforeLoad) only protect UI — every server function
 * touching user data must use this.
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return next({ context: { user: session.user } });
});
