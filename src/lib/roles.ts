import { eq } from "drizzle-orm";

import { db } from "#/db";
import { user as userTable } from "#/db/schema";

/**
 * Role resolution. Lives in its own module so it is only ever imported *inside*
 * a `.server()` / `.handler()` callback — the TanStack Start plugin strips those
 * on the client, which keeps `db` (and better-sqlite3's native binding) out of
 * the browser bundle. Reference it from module scope and the client build breaks.
 */

const adminEmails = () =>
	(process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);

/**
 * The user's role, promoting them to admin first if ADMIN_EMAILS lists their
 * address. That bootstraps the first admin per environment with no manual SQL;
 * admins promote others from the panel afterwards.
 *
 * Read from the DB rather than the session, so a demotion takes effect on the
 * next request instead of when the session cookie expires.
 */
export async function resolveRole(userId: string, email: string) {
	const [row] = await db
		.select({ role: userTable.role })
		.from(userTable)
		.where(eq(userTable.id, userId));
	const role = row?.role ?? "user";
	if (role !== "admin" && adminEmails().includes(email.toLowerCase())) {
		await db
			.update(userTable)
			.set({ role: "admin", updatedAt: new Date() })
			.where(eq(userTable.id, userId));
		return "admin";
	}
	return role;
}
