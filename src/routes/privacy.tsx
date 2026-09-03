import { createFileRoute } from "@tanstack/react-router";

import { StaticShell } from "#/components/static-page";

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [
			{ title: "Privacy Policy — CVATSFriendly" },
			{
				name: "description",
				content:
					"How CVATSFriendly collects, uses and protects your data. Your CVs belong to you — export or delete them at any time.",
			},
		],
	}),
	component: () => (
		<StaticShell
			page="privacy"
			path="/privacy"
			title="Privacy Policy"
			description="What we collect, why, and the controls you have. Plain language, no dark patterns."
		>
			{/* ponytail: generic template policy — replace with counsel-reviewed text before scale. */}
			<p>
				<strong className="text-neutral-200">Data we collect.</strong> Your
				account details (name, email) and the CV content you write. We use them
				only to provide the service: storing your CVs, running the AI assistant
				and the ATS score checker, and sending essential account emails.
			</p>
			<p>
				<strong className="text-neutral-200">What we never do.</strong> We don't
				sell your data, don't share your CV content with recruiters or third
				parties, and don't use your documents for advertising.
			</p>
			<p>
				<strong className="text-neutral-200">AI processing.</strong> Text you
				submit for AI rewriting or ATS analysis is sent to our model provider
				for that request only and is not used to train models.
			</p>
			<p>
				<strong className="text-neutral-200">Your controls.</strong> Export your
				CVs as PDF at any time, or delete your account and all associated data
				from your dashboard. Deletion is permanent and completes within 30 days
				across backups.
			</p>
			<p>
				<strong className="text-neutral-200">Cookies.</strong> We use a single
				session cookie for login and privacy-respecting analytics. No
				third-party ad trackers.
			</p>
			<p>
				Questions about this policy? See our contact page — we answer every
				privacy request personally.
			</p>
		</StaticShell>
	),
});
