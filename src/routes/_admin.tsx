import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";

import { getSession } from "#/lib/auth-functions";

/**
 * Admin shell. The guard here only hides UI — authorization lives in
 * adminMiddleware on every server fn in src/lib/admin-functions.ts.
 *
 * ponytail: admin copy is English, not paraglide. It would add ~45 keys × 2
 * locales for a screen only operators see; localize if non-English operators
 * ever administer this.
 */
export const Route = createFileRoute("/_admin")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
	},
	loader: () => getSession(),
	component: AdminShell,
});

const TABS = [
	{ to: "/admin", label: "Overview", exact: true },
	{ to: "/admin/users", label: "Users", exact: false },
	{ to: "/admin/templates", label: "Templates", exact: false },
] as const;

function AdminShell() {
	// beforeLoad guarantees an admin session when this renders.
	// biome-ignore lint/style/noNonNullAssertion: guarded by beforeLoad redirect
	const session = Route.useLoaderData()!;
	return (
		<div className="min-h-screen bg-neutral-950">
			<header className="flex flex-wrap items-center gap-6 border-b border-neutral-800 px-6 py-4">
				<Link
					to="/dashboard"
					className="font-display text-lg font-bold tracking-tight text-white"
				>
					resmio<span className="text-brand-400">.</span>
					<span className="ml-2 rounded bg-brand-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-widest text-brand-300 uppercase">
						admin
					</span>
				</Link>
				<nav className="flex items-center gap-5">
					{TABS.map((t) => (
						<Link
							key={t.to}
							to={t.to}
							activeOptions={{ exact: t.exact }}
							className="text-sm text-neutral-400 transition-colors hover:text-white"
							activeProps={{ className: "text-white" }}
						>
							{t.label}
						</Link>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-4 text-sm text-neutral-400">
					<span className="hidden sm:block">{session.user.email}</span>
					<Link to="/dashboard" className="btn-secondary">
						Exit admin
					</Link>
				</div>
			</header>
			<Outlet />
		</div>
	);
}
