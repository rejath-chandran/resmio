import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cashfree PG client (API v2023-08-01) over plain fetch — no server SDK, matching
 * the OpenAI-over-fetch decision. Server-only: import it *inside* a `.server()` /
 * `.handler()` callback (secrets must never reach the client bundle — see roles.ts).
 */

const API_VERSION = "2023-08-01";

export type CashfreeMode = "sandbox" | "production";

export function mode(): CashfreeMode {
	return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function baseUrl(): string {
	return mode() === "production"
		? "https://api.cashfree.com/pg"
		: "https://sandbox.cashfree.com/pg";
}

const appId = () => process.env.CASHFREE_APP_ID ?? "";
const secret = () => process.env.CASHFREE_SECRET_KEY ?? "";

/** Both keys present — the billing UI/fns degrade gracefully when they aren't. */
export function isConfigured(): boolean {
	return Boolean(appId() && secret());
}

function headers(): HeadersInit {
	return {
		"content-type": "application/json",
		"x-api-version": API_VERSION,
		"x-client-id": appId(),
		"x-client-secret": secret(),
	};
}

export type CashfreeOrder = {
	order_id: string;
	cf_order_id?: string | number;
	order_status: string; // ACTIVE | PAID | EXPIRED | TERMINATED ...
	payment_session_id?: string;
};

type CashfreeError = { message?: string; code?: string; type?: string };

/**
 * Turns a failed Cashfree response into an Error. A 401 means our *merchant keys*
 * are wrong — never the end user's session — so we log the real reason server-side
 * and surface a message that won't be mistaken for a login failure.
 */
function apiError(res: Response, body: CashfreeError, action: string): Error {
	if (res.status === 401 || body.type === "authentication_error") {
		console.error(
			`[cashfree] auth rejected on ${action} (${mode()}): ${body.code ?? ""} ${body.message ?? ""} — check CASHFREE_APP_ID / CASHFREE_SECRET_KEY match CASHFREE_ENV.`,
		);
		return new Error(
			"Payments are temporarily unavailable. Please try again later.",
		);
	}
	console.error(
		`[cashfree] ${action} failed (${res.status}): ${body.code ?? ""} ${body.message ?? ""}`,
	);
	return new Error(body.message || `Cashfree ${action} failed (${res.status})`);
}

/**
 * Creates an order. We supply our own `order_id` (the payments row id) so the
 * return/webhook can look the payment up without a second id to reconcile.
 */
export async function createOrder(input: {
	orderId: string;
	amount: number;
	currency: string;
	customer: { id: string; email: string; phone: string };
	returnUrl: string;
}): Promise<CashfreeOrder> {
	const res = await fetch(`${baseUrl()}/orders`, {
		method: "POST",
		headers: headers(),
		body: JSON.stringify({
			order_id: input.orderId,
			order_amount: input.amount,
			order_currency: input.currency,
			customer_details: {
				customer_id: input.customer.id,
				customer_email: input.customer.email,
				customer_phone: input.customer.phone,
			},
			order_meta: { return_url: input.returnUrl },
		}),
	});
	const json = (await res.json()) as CashfreeOrder & CashfreeError;
	if (!res.ok) throw apiError(res, json, "order create");
	return json;
}

/** Fetches order status — the source of truth we verify against before granting Pro. */
export async function getOrder(orderId: string): Promise<CashfreeOrder> {
	const res = await fetch(
		`${baseUrl()}/orders/${encodeURIComponent(orderId)}`,
		{
			method: "GET",
			headers: headers(),
		},
	);
	const json = (await res.json()) as CashfreeOrder & CashfreeError;
	if (!res.ok) throw apiError(res, json, "order fetch");
	return json;
}

/**
 * Verifies a webhook signature. Cashfree signs base64(HMAC-SHA256(timestamp+rawBody,
 * secretKey)). Pure + constant-time — mandatory before trusting any webhook payload.
 */
export function verifyWebhookSignature(
	timestamp: string,
	rawBody: string,
	signature: string,
): boolean {
	if (!secret() || !signature) return false;
	const expected = createHmac("sha256", secret())
		.update(timestamp + rawBody)
		.digest("base64");
	const a = Buffer.from(expected);
	const b = Buffer.from(signature);
	return a.length === b.length && timingSafeEqual(a, b);
}
