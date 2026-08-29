import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { authClient } from "#/lib/auth-client";
import { getBillingState } from "#/lib/billing-functions";
import { m } from "#/paraglide/messages";

export function DashboardHeader({
	user,
}: {
	user: { name: string; email: string; role?: string };
}) {
	const { data: billing } = useQuery({
		queryKey: ["billing"],
		queryFn: () => getBillingState(),
	});
	return (
		<header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
			<div className="flex items-center gap-8">
				<Link
					to="/"
					className="font-display text-lg font-bold tracking-tight text-white"
				>
					resmio<span className="text-brand-400">.</span>
				</Link>
				<Link
					to="/dashboard"
					className="text-sm text-neutral-400 transition-colors hover:text-white"
					activeProps={{ className: "text-white" }}
				>
					{m.nav_dashboard()}
				</Link>
				{user.role === "admin" && (
					<Link
						to="/admin"
						className="text-sm text-brand-400 transition-colors hover:text-brand-300"
						activeProps={{ className: "text-brand-300" }}
					>
						Admin
					</Link>
				)}
			</div>
			<div className="flex items-center gap-4">
				<Link
					to="/dashboard/billing"
					className="text-sm transition-colors"
					activeProps={{ className: "text-white" }}
				>
					{billing?.pro ? (
						<span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
							Pro
						</span>
					) : (
						<span className="text-brand-400 hover:text-brand-300">Upgrade</span>
					)}
				</Link>
				<span className="hidden text-sm text-neutral-400 sm:block">
					{user.name || user.email}
				</span>
				<button
					type="button"
					onClick={() => {
						void authClient.signOut().then(() => {
							window.location.href = "/";
						});
					}}
					className="btn-secondary"
				>
					{m.nav_signout()}
				</button>
			</div>
		</header>
	);
}
