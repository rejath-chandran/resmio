import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";

import { auth } from "#/lib/auth";

/**
 * Returns the current session (or null) so route guards can run server-side
 * before any render. ponytail: only session fetch is exposed — user mutation
 * APIs stay internal to better-auth until a settings page exists.
 */
export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({
			headers: getRequest().headers,
		});
		if (!session) return null;
		return {
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image ?? null,
			},
		};
	},
);
