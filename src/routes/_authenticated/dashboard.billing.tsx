import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	confirmPayment,
	createCheckout,
	getBillingState,
} from "#/lib/billing-functions";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
	validateSearch: (search: Record<string, unknown>): { order_id?: string } =>
		typeof search.order_id === "string" ? { order_id: search.order_id } : {},
	component: Billing,
});

type CashfreeCheckout = (opts: {
	paymentSessionId: string;
	redirectTarget?: string;
}) => void;
declare global {
	interface Window {
		Cashfree?: (opts: { mode: string }) => { checkout: CashfreeCheckout };
	}
}

/** Loads the Cashfree v3 checkout SDK once, on demand. */
function loadCashfree(): Promise<NonNullable<Window["Cashfree"]>> {
	if (window.Cashfree) return Promise.resolve(window.Cashfree);
	return new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
		s.onload = () =>
			window.Cashfree
				? resolve(window.Cashfree)
				: reject(new Error("Cashfree SDK failed to load"));
		s.onerror = () => reject(new Error("Cashfree SDK failed to load"));
		document.head.appendChild(s);
	});
}

function Billing() {
	const { order_id } = Route.useSearch();
	const queryClient = useQueryClient();
	const [msg, setMsg] = useState<string | null>(null);

	const { data, isPending } = useQuery({
		queryKey: ["billing"],
		queryFn: () => getBillingState(),
	});

	// PLACEHOLDER_MUTATIONS
	const upgrade = useMutation({
		mutationFn: async () => {
			const { paymentSessionId, mode } = await createCheckout({
				data: { planId: "pro" },
			});
			const cf = (await loadCashfree())({ mode });
			cf.checkout({ paymentSessionId, redirectTarget: "_self" });
		},
	});

	const verify = useMutation({
		mutationFn: (orderId: string) => confirmPayment({ data: { orderId } }),
		onSuccess: async (res) => {
			await queryClient.invalidateQueries({ queryKey: ["billing"] });
			setMsg(
				res.pro
					? "Payment confirmed — welcome to Pro! 🎉"
					: res.status === "PAID"
						? "Payment received; activating your plan…"
						: `Payment ${res.status.toLowerCase()}. If you were charged, it will reflect shortly.`,
			);
		},
		onError: (e) =>
			setMsg(e instanceof Error ? e.message : "Could not verify payment."),
	});

	// On return from Cashfree, verify the order server-side (never trust the redirect).
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per order_id
	useEffect(() => {
		if (order_id) verify.mutate(order_id);
	}, [order_id]);

	const plan = data?.plan;
	const expiry = data?.currentPeriodEnd
		? new Date(data.currentPeriodEnd).toLocaleDateString()
		: null;

	return (
		<main className="mx-auto max-w-2xl px-6 py-12">
			<Link to="/dashboard" className="btn-ghost">
				← Dashboard
			</Link>
			<h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
				Billing
			</h1>

			{msg && (
				<output className="mt-4 block rounded-lg border border-brand-500/40 bg-brand-950/40 px-4 py-3 text-sm text-brand-200">
					{msg}
				</output>
			)}

			{isPending ? (
				<p className="mt-8 text-neutral-500">…</p>
			) : data?.pro ? (
				<div className="card mt-6 p-6">
					<div className="flex items-center gap-2">
						<h2 className="font-semibold text-white">Pro</h2>
						<span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
							active
						</span>
					</div>
					<p className="mt-2 text-sm text-neutral-400">
						You have unlimited resumes, all Pro templates and unlimited AI
						edits.
						{expiry && ` Renews/expires on ${expiry}.`}
					</p>
					<button
						type="button"
						className="btn-secondary mt-6"
						disabled={upgrade.isPending}
						onClick={() => upgrade.mutate()}
					>
						{upgrade.isPending ? "Opening…" : "Extend subscription"}
					</button>
				</div>
			) : (
				<div className="card mt-6 p-6">
					<div className="flex items-baseline justify-between">
						<h2 className="font-semibold text-white">{plan?.name ?? "Pro"}</h2>
						{plan && (
							<div className="text-right">
								<span className="font-display text-3xl font-bold text-white">
									₹{plan.priceInr}
								</span>
								<span className="text-sm text-neutral-500">
									{" "}
									/ {plan.durationDays} days
								</span>
							</div>
						)}
					</div>
					<ul className="mt-5 space-y-2 text-sm text-neutral-300">
						{[
							"Unlimited resumes",
							"All Pro templates",
							"Unlimited AI edits",
							"PDF export",
						].map((f) => (
							<li key={f} className="flex items-center gap-2.5">
								<span className="text-brand-400">✓</span> {f}
							</li>
						))}
					</ul>

					{data?.configured === false ? (
						<p className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
							Payments are not configured on this environment yet.
						</p>
					) : (
						<button
							type="button"
							className="btn-primary mt-6 w-full"
							disabled={upgrade.isPending || verify.isPending || !plan}
							onClick={() => upgrade.mutate()}
						>
							{upgrade.isPending ? "Opening checkout…" : "Upgrade to Pro"}
						</button>
					)}
					{upgrade.error && (
						<p className="mt-3 text-sm text-red-400" role="alert">
							{upgrade.error instanceof Error
								? upgrade.error.message
								: String(upgrade.error)}
						</p>
					)}
					<p className="mt-3 text-center text-xs text-neutral-600">
						Secure payments by Cashfree. UPI, cards, net banking.
					</p>
				</div>
			)}
		</main>
	);
}
