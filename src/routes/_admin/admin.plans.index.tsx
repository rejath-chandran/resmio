import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { listPlansAdmin, updatePlan } from "#/lib/admin-functions";
import { Problem } from "./admin.index";

export const Route = createFileRoute("/_admin/admin/plans/")({
	component: AdminPlans,
});

type PlanRow = Awaited<ReturnType<typeof listPlansAdmin>>[number];

function AdminPlans() {
	const queryClient = useQueryClient();
	const { data, isPending, error } = useQuery({
		queryKey: ["admin", "plans"],
		queryFn: () => listPlansAdmin(),
	});

	if (error) return <Problem error={error} />;

	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<h1 className="font-display text-2xl font-bold tracking-tight text-white">
				Plans
			</h1>
			<p className="mt-1 text-sm text-neutral-400">
				Prices and durations take effect immediately for new checkouts. Existing
				subscriptions keep the terms they were bought under.
			</p>

			{isPending ? (
				<p className="mt-8 text-neutral-500">…</p>
			) : (
				<div className="mt-6 space-y-4">
					{data?.map((p) => (
						<PlanCard
							key={p.id}
							plan={p}
							onSaved={() =>
								queryClient.invalidateQueries({ queryKey: ["admin"] })
							}
						/>
					))}
					{data?.length === 0 && (
						<p className="text-sm text-neutral-500">
							No plans. Seed one first.
						</p>
					)}
				</div>
			)}
		</main>
	);
}

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
	const [name, setName] = useState(plan.name);
	const [priceInr, setPriceInr] = useState(String(plan.priceInr));
	const [durationDays, setDurationDays] = useState(String(plan.durationDays));
	const [isActive, setIsActive] = useState(plan.isActive);

	const save = useMutation({
		mutationFn: () =>
			updatePlan({
				data: {
					id: plan.id,
					name,
					priceInr: Number(priceInr),
					durationDays: Number(durationDays),
					isActive,
				},
			}),
		onSuccess: onSaved,
	});

	return (
		<form
			className="card p-5"
			onSubmit={(e) => {
				e.preventDefault();
				save.mutate();
			}}
		>
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-white">
					{plan.name}{" "}
					<span className="text-xs font-normal text-neutral-500">
						· {plan.id}
					</span>
				</h2>
				{!plan.isActive && (
					<span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] tracking-wide text-neutral-400 uppercase">
						off
					</span>
				)}
			</div>

			<div className="mt-4 grid gap-4 sm:grid-cols-3">
				<div className="sm:col-span-3">
					<label className="label" htmlFor={`name-${plan.id}`}>
						Name
					</label>
					<input
						id={`name-${plan.id}`}
						className="input"
						value={name}
						maxLength={60}
						required
						onChange={(e) => setName(e.target.value)}
					/>
				</div>
				<div>
					<label className="label" htmlFor={`price-${plan.id}`}>
						Price ({plan.currency})
					</label>
					<input
						id={`price-${plan.id}`}
						type="number"
						min={1}
						className="input"
						value={priceInr}
						required
						onChange={(e) => setPriceInr(e.target.value)}
					/>
				</div>
				<div>
					<label className="label" htmlFor={`days-${plan.id}`}>
						Duration (days)
					</label>
					<input
						id={`days-${plan.id}`}
						type="number"
						min={1}
						className="input"
						value={durationDays}
						required
						onChange={(e) => setDurationDays(e.target.value)}
					/>
				</div>
				<label
					className="flex items-end gap-2 pb-2 text-sm text-neutral-300"
					htmlFor={`active-${plan.id}`}
				>
					<input
						id={`active-${plan.id}`}
						type="checkbox"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="h-4 w-4 accent-brand-500"
					/>
					Active
				</label>
			</div>

			{save.error && (
				<p className="mt-3 text-sm text-red-400" role="alert">
					{save.error instanceof Error
						? save.error.message
						: String(save.error)}
				</p>
			)}

			<div className="mt-4 flex items-center gap-3">
				<button type="submit" className="btn-primary" disabled={save.isPending}>
					{save.isPending ? "Saving…" : "Save"}
				</button>
				{save.isSuccess && !save.isPending && (
					<span className="text-xs text-brand-400">Saved.</span>
				)}
			</div>
		</form>
	);
}
