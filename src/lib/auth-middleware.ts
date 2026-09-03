import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";

/**
 * Server-function middleware: enforces an authenticated session.
 * Route guards (beforeLoad) only protect UI — every server function
 * touching user data must use this.
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
	// Imported inside the handler: better-auth's server bundle must not ship to
	// the browser on routes whose client code merely references server fns.
	const { auth } = await import("#/lib/auth");
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return next({ context: { user: session.user } });
});

/** Every admin server function must use this — the route guard only hides UI. */
export const adminMiddleware = createMiddleware()
	.middleware([authMiddleware])
	.server(async ({ next, context }) => {
		// Imported here, not at module scope: see the note in src/lib/roles.ts.
		const { resolveRole } = await import("#/lib/roles");
		const role = await resolveRole(context.user.id, context.user.email);
		if (role !== "admin") throw new Error("Forbidden");
		return next({ context: { user: context.user } });
	});
