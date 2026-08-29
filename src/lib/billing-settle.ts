import { and, eq, ne } from "drizzle-orm";

import { db } from "#/db";
import { payments, plans, subscriptions } from "#/db/schema";
import { computePeriodEnd } from "#/lib/entitlements";

/**
 * Server-only subscription settlement. Kept out of billing-functions.ts because
 * these are plain (non-server-fn) exports that touch `db`: bundling them beside
 * the client-imported server fns would drag better-sqlite3 into the browser
 * bundle (see the note in src/lib/roles.ts). Import this only from a webhook
 * route or inside a `.handler()`.
 */

/**
 * Grants/extends the subscription for a paid order. Idempotent at the call site:
 * only invoked after the winning conditional update on the payment row, so a
 * webhook and a return-verify racing the same order activate exactly once.
 */
async function activateSubscription(userId: string, planId: string) {
	// Read duration from the plan row (active or not — a purchase already happened).
	const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
	const durationDays = plan?.durationDays ?? 60;

	const [existing] = await db
		.select()
		.from(subscriptions)
		.where(
			and(eq(subscriptions.userId, userId), eq(subscriptions.planId, planId)),
		)
		.orderBy(subscriptions.currentPeriodEnd);

	const periodEnd = computePeriodEnd(
		existing ? existing.currentPeriodEnd : null,
		durationDays,
	);

	if (existing) {
		await db
			.update(subscriptions)
			.set({
				status: "active",
				currentPeriodEnd: periodEnd,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.id, existing.id));
	} else {
		await db.insert(subscriptions).values({
			id: crypto.randomUUID(),
			userId,
			planId,
			status: "active",
			currentPeriodEnd: periodEnd,
		});
	}
}

/**
 * Marks the order paid and activates the subscription, exactly once. Returns
 * whether this call was the one that flipped it. Shared by confirmPayment + webhook.
 */
export async function settlePaidOrder(orderId: string): Promise<boolean> {
	const won = await db
		.update(payments)
		.set({ status: "paid", updatedAt: new Date() })
		.where(and(eq(payments.id, orderId), ne(payments.status, "paid")))
		.returning({ userId: payments.userId, planId: payments.planId });
	if (won.length === 0) return false;
	await activateSubscription(won[0].userId, won[0].planId);
	return true;
}
