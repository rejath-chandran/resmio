import { createFileRoute } from "@tanstack/react-router";

import { settlePaidOrder } from "#/lib/billing-settle";
import { verifyWebhookSignature } from "#/lib/cashfree";

/**
 * Cashfree payment webhook. Signature verification is mandatory before trusting
 * the payload; on a successful payment we run the same idempotent activation as
 * the return-verify path, so whichever arrives first grants Pro exactly once.
 */
export const Route = createFileRoute("/api/cashfree/webhook")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const raw = await request.text();
				const signature = request.headers.get("x-webhook-signature") ?? "";
				const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
				if (!verifyWebhookSignature(timestamp, raw, signature)) {
					return new Response("Invalid signature", { status: 401 });
				}

				let payload: {
					type?: string;
					data?: {
						order?: { order_id?: string };
						payment?: { payment_status?: string };
					};
				};
				try {
					payload = JSON.parse(raw);
				} catch {
					return new Response("Invalid JSON", { status: 400 });
				}

				const orderId = payload.data?.order?.order_id;
				const status = payload.data?.payment?.payment_status;
				if (orderId && status === "SUCCESS") {
					await settlePaidOrder(orderId);
				}
				// Always 200 on a verified webhook so Cashfree stops retrying.
				return new Response("ok", { status: 200 });
			},
		},
	},
});
