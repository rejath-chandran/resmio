import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";
import { getSession } from "#/lib/auth-functions";
import { m } from "#/paraglide/messages";
import { AuthField, AuthShell, SocialButtons } from "#/routes/login";

export const Route = createFileRoute("/signup")({
	validateSearch: (search: Record<string, unknown>) => {
		const redirect =
			typeof search.redirect === "string" ? search.redirect : "/";
		return {
			redirect:
				redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/",
		};
	},
	beforeLoad: async ({ search }) => {
		const session = await getSession();
		if (session) throw redirect({ to: search.redirect });
	},
	component: Signup,
});

function Signup() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);
		const { error: err } = await authClient.signUp.email({
			name,
			email,
			password,
		});
		setPending(false);
		if (err) {
			setError(m.auth_error_generic());
			return;
		}
		await navigate({ to: "/dashboard" });
	}

	return (
		<AuthShell>
			<h1 className="text-2xl font-semibold text-white">
				{m.auth_signup_title()}
			</h1>
			<p className="mt-2 text-sm text-neutral-400">
				{m.auth_signup_subtitle()}
			</p>
			<form onSubmit={handleSubmit} className="mt-8 space-y-4">
				<AuthField label={m.auth_name()}>
					<input
						type="text"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="auth-input"
						autoComplete="name"
					/>
				</AuthField>
				<AuthField label={m.auth_email()}>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="auth-input"
						autoComplete="email"
					/>
				</AuthField>
				<AuthField label={m.auth_password()}>
					<input
						type="password"
						required
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="auth-input"
						autoComplete="new-password"
					/>
				</AuthField>
				{error && (
					<p role="alert" className="text-sm text-red-400">
						{error}
					</p>
				)}
				<button type="submit" disabled={pending} className="btn-primary w-full">
					{pending ? m.auth_working() : m.auth_signup_cta()}
				</button>
			</form>
			<SocialButtons redirect={search.redirect} />
			<p className="mt-6 text-center text-sm text-neutral-400">
				{m.auth_have_account()}{" "}
				<Link
					to="/login"
					search={{ redirect: search.redirect }}
					className="text-indigo-400 hover:underline"
				>
					{m.auth_login_link()}
				</Link>
			</p>
		</AuthShell>
	);
}
