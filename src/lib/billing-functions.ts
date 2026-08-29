import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne } from "drizzle-orm";

import { db } from "#/db";
import { payments, plans, subscriptions } from "#/db/schema";
import { authMiddleware } from "#/lib/auth-middleware";
import { createOrder, getOrder, isConfigured, mode } from "#/lib/cashfree";
import { isProUser } from "#/lib/entitlements";

/**
 * Billing server functions. The client never decides entitlement — payment is
 * always verified against Cashfree server-side before Pro is granted.
 */

type PlanView = {
	id: string;
	name: string;
	priceInr: number;
	currency: string;
	durationDays: number;
};

async function activePlan(id: string): Promise<PlanView | null> {
	const [row] = await db
		.select()
		.from(plans)
		.where(and(eq(plans.id, id), eq(plans.isActive, true)));
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		priceInr: row.priceInr,
		currency: row.currency,
		durationDays: row.durationDays,
	};
}

export const getBillingState = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const pro = await isProUser(context.user.id);
		const [sub] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, context.user.id))
			.orderBy(subscriptions.currentPeriodEnd);
		const plan = await activePlan("pro");
		return {
			pro,
			configured: isConfigured(),
			currentPeriodEnd: sub ? sub.currentPeriodEnd.getTime() : null,
			plan,
		};
	});

export const createCheckout = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { planId: string }) => ({
		planId: String(input.planId).slice(0, 40),
	}))
	.handler(async ({ context, data }) => {
		if (!isConfigured()) {
			throw new Error(
				"Payments are not configured yet. Please try again later.",
			);
		}
		const plan = await activePlan(data.planId);
		if (!plan) throw new Error("Plan not available");
		if (await isProUser(context.user.id)) {
			throw new Error("You already have an active Pro subscription");
		}

		const orderId = crypto.randomUUID();
		await db.insert(payments).values({
			id: orderId,
			userId: context.user.id,
			planId: plan.id,
			amount: plan.priceInr,
			currency: plan.currency,
			status: "created",
		});

		const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
		const order = await createOrder({
			orderId,
			amount: plan.priceInr,
			currency: plan.currency,
			customer: {
				id: context.user.id,
				email: context.user.email,
				// ponytail: no phone field on the user yet — Cashfree requires one.
				phone: "9999999999",
			},
			returnUrl: `${appUrl}/dashboard/billing?order_id=${orderId}`,
		});

		await db
			.update(payments)
			.set({
				cfOrderId: String(order.cf_order_id ?? ""),
				paymentSessionId: order.payment_session_id ?? "",
				updatedAt: new Date(),
			})
			.where(eq(payments.id, orderId));

		return {
			orderId,
			paymentSessionId: order.payment_session_id ?? "",
			mode: mode(),
		};
	});

export const confirmPayment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input: { orderId: string }) => ({
		orderId: String(input.orderId).slice(0, 40),
	}))
	.handler(async ({ context, data }) => {
		const [row] = await db
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.id, data.orderId),
					eq(payments.userId, context.user.id),
				),
			);
		if (!row) throw new Error("Unknown order");

		const order = await getOrder(data.orderId);
		if (order.order_status === "PAID") {
			// Imported inside the handler so this module's client-imported server
			// fns don't drag the db-touching settle code into the browser bundle.
			const { settlePaidOrder } = await import("#/lib/billing-settle");
			await settlePaidOrder(data.orderId);
		} else if (
			order.order_status === "EXPIRED" ||
			order.order_status === "TERMINATED"
		) {
			await db
				.update(payments)
				.set({ status: "failed", updatedAt: new Date() })
				.where(and(eq(payments.id, data.orderId), ne(payments.status, "paid")));
		}
		return {
			status: order.order_status,
			pro: await isProUser(context.user.id),
		};
	});
