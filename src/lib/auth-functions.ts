import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";

import { auth } from "#/lib/auth";
import { authMiddleware } from "#/lib/auth-middleware";

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
		// Imported here, not at module scope: see the note in src/lib/roles.ts.
		const { resolveRole } = await import("#/lib/roles");
		return {
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image ?? null,
				role: await resolveRole(session.user.id, session.user.email),
			},
		};
	},
);

/**
 * Deletes the caller's own account. Resumes cascade via the FK in schema.ts.
 * Irreversible, so the UI gates it behind window.confirm; the last admin is
 * refused so an environment can't lock itself out of the panel.
 */
export const deleteAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const [{ eq }, { db }, { user: userTable }, { resolveRole }] =
			await Promise.all([
				import("drizzle-orm"),
				import("#/db"),
				import("#/db/schema"),
				import("#/lib/roles"),
			]);
		const role = await resolveRole(context.user.id, context.user.email);
		if (role === "admin") {
			const admins = await db
				.select({ id: userTable.id })
				.from(userTable)
				.where(eq(userTable.role, "admin"));
			if (admins.length <= 1) {
				throw new Error("Cannot delete the last admin account");
			}
		}
		await db.delete(userTable).where(eq(userTable.id, context.user.id));
		return { ok: true };
	});
