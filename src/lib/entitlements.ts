import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "#/db";
import { subscriptions } from "#/db/schema";

/**
 * Entitlements: what a user is allowed to do. Server-only (touches `db`) — import
 * inside a `.server()` / `.handler()` callback, per the note in src/lib/roles.ts.
 *
 * ponytail: free caps are constants, not per-plan config. Lift into the `plans`
 * table if tiers ever need different limits.
 */
export const FREE_RESUME_LIMIT = 2;
export const FREE_AI_CALLS_PER_DAY = 10;

/** Pro = an active subscription whose window hasn't closed yet. */
export async function isProUser(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: subscriptions.id })
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.userId, userId),
				eq(subscriptions.status, "active"),
				gt(subscriptions.currentPeriodEnd, new Date()),
			),
		)
		.orderBy(desc(subscriptions.currentPeriodEnd))
		.limit(1);
	return Boolean(row);
}

/**
 * New period end after buying `durationDays`. Extends from the later of now and any
 * remaining window, so renewing early stacks the time instead of losing it. Pure.
 */
export function computePeriodEnd(
	currentEnd: Date | null,
	durationDays: number,
	now: Date = new Date(),
): Date {
	const from =
		currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
	return new Date(from.getTime() + durationDays * 86_400_000);
}

/** UTC day key for the ai_usage row. */
export function utcDay(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}
