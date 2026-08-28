import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardHeader } from "#/components/dashboard-header";
import { getSession } from "#/lib/auth-functions";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
	},
	loader: () => getSession(),
	component: () => {
		// beforeLoad guarantees a session when this renders.
		// biome-ignore lint/style/noNonNullAssertion: guarded by beforeLoad redirect
		const session = Route.useLoaderData()!;
		return (
			<div className="min-h-screen bg-neutral-950">
				<DashboardHeader user={session.user} />
				<Outlet />
			</div>
		);
	},
});
