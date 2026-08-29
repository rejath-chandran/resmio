import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

/**
 * Billing self-check — pure logic, no network, no DB writes. Run with:
 *   npx tsx ./billing.check.mjs
 * Covers the two bits of non-trivial billing logic: webhook signature
 * verification and subscription period math.
 */

process.env.CASHFREE_SECRET_KEY = "test-secret-key";

const { verifyWebhookSignature } = await import("./src/lib/cashfree.ts");
const { computePeriodEnd } = await import("./src/lib/entitlements.ts");

// --- verifyWebhookSignature ---
const timestamp = "1700000000";
const body = JSON.stringify({ data: { order: { order_id: "o1" } } });
const goodSig = createHmac("sha256", "test-secret-key")
	.update(timestamp + body)
	.digest("base64");

assert.equal(
	verifyWebhookSignature(timestamp, body, goodSig),
	true,
	"valid signature must verify",
);
assert.equal(
	verifyWebhookSignature(timestamp, body, "tampered"),
	false,
	"bad signature must be rejected",
);
assert.equal(
	verifyWebhookSignature(timestamp, `${body} `, goodSig),
	false,
	"tampered body must be rejected",
);
assert.equal(
	verifyWebhookSignature(timestamp, body, ""),
	false,
	"empty signature must be rejected",
);

// --- computePeriodEnd ---
const now = new Date("2026-01-01T00:00:00Z");
const DAY = 86_400_000;

// Fresh purchase: from now + duration.
assert.equal(
	computePeriodEnd(null, 60, now).getTime(),
	now.getTime() + 60 * DAY,
	"fresh subscription runs from now",
);

// Renew mid-period: stacks onto the remaining window.
const midEnd = new Date(now.getTime() + 10 * DAY);
assert.equal(
	computePeriodEnd(midEnd, 60, now).getTime(),
	midEnd.getTime() + 60 * DAY,
	"early renewal stacks time instead of losing it",
);

// Renew after expiry: from now, not from the stale end.
const pastEnd = new Date(now.getTime() - 5 * DAY);
assert.equal(
	computePeriodEnd(pastEnd, 60, now).getTime(),
	now.getTime() + 60 * DAY,
	"expired subscription restarts from now",
);

console.log("billing.check.mjs — all assertions passed ✓");
