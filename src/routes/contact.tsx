import { createFileRoute } from "@tanstack/react-router";

import { StaticShell } from "#/components/static-page";

export const Route = createFileRoute("/contact")({
	head: () => ({
		meta: [
			{ title: "Contact — CVATSFriendly" },
			{
				name: "description",
				content:
					"Get in touch with the CVATSFriendly team — questions, feedback or support about your ATS friendly CV.",
			},
		],
	}),
	component: () => (
		<StaticShell
			page="contact"
			path="/contact"
			title="Contact us"
			description="Questions, feedback or support — email the CVATSFriendly team."
		>
			<p>
				Questions about your CV, the ATS score checker, your account or billing?
				We read everything.
			</p>
			<p>
				Email:{" "}
				<a
					href="mailto:support@cvatsfriendly.com"
					className="font-semibold text-brand-300 hover:text-brand-200"
				>
					support@cvatsfriendly.com
				</a>
			</p>
			<p>
				Bugs and feature ideas are welcome too — tell us what would make your
				job hunt easier and we'll build it.
			</p>
		</StaticShell>
	),
});
