import { Link } from "@tanstack/react-router";

import { authClient } from "#/lib/auth-client";
import { m } from "#/paraglide/messages";

export function DashboardHeader({
	user,
}: {
	user: { name: string; email: string };
}) {
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
			</div>
			<div className="flex items-center gap-4">
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
