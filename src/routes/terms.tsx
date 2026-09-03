import { createFileRoute } from "@tanstack/react-router";

import { StaticShell } from "#/components/static-page";

export const Route = createFileRoute("/terms")({
	head: () => ({
		meta: [
			{ title: "Terms of Service — CVATSFriendly" },
			{
				name: "description",
				content:
					"Terms of service for using CVATSFriendly, the free AI builder for ATS friendly CVs.",
			},
		],
	}),
	component: () => (
		<StaticShell
			page="terms"
			path="/terms"
			title="Terms of Service"
			description="The short, honest terms for using CVATSFriendly."
		>
			{/* ponytail: generic template terms — replace with counsel-reviewed text before scale. */}
			<p>
				<strong className="text-neutral-200">The service.</strong> CVATSFriendly
				provides an online CV builder. Free-plan accounts get core features; Pro
				accounts unlock the ATS score checker, priority AI and unlimited
				versions, billed monthly and cancellable anytime.
			</p>
			<p>
				<strong className="text-neutral-200">Your content.</strong> You own
				everything you create. We only store and process it to provide the
				service. You're responsible for the accuracy of what you write — don't
				misrepresent qualifications.
			</p>
			<p>
				<strong className="text-neutral-200">Acceptable use.</strong> No
				scraping, reverse engineering, automated abuse, or uploading unlawful
				content. Accounts used for abuse may be suspended.
			</p>
			<p>
				<strong className="text-neutral-200">No guarantees.</strong> We work
				hard to keep ATS scores and AI suggestions useful, but hiring outcomes
				depend on many factors outside our control. The service is provided as
				is.
			</p>
			<p>
				<strong className="text-neutral-200">Changes.</strong> We may update
				these terms; material changes will be announced in-app before taking
				effect.
			</p>
		</StaticShell>
	),
});
