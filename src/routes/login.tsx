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

export const Route = createFileRoute("/login")({
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
	component: Login,
});

function Login() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);
		const { error: err } = await authClient.signIn.email({ email, password });
		setPending(false);
		if (err) {
			setError(m.auth_error_generic());
			return;
		}
		await navigate({ to: search.redirect });
	}

	return (
		<AuthShell>
			<h1 className="text-2xl font-semibold text-white">
				{m.auth_login_title()}
			</h1>
			<p className="mt-2 text-sm text-neutral-400">{m.auth_login_subtitle()}</p>
			<form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
						autoComplete="current-password"
					/>
				</AuthField>
				{error && (
					<p role="alert" className="text-sm text-red-400">
						{error}
					</p>
				)}
				<button type="submit" disabled={pending} className="btn-primary w-full">
					{pending ? m.auth_working() : m.auth_login_cta()}
				</button>
			</form>
			<p className="mt-6 text-center text-sm text-neutral-400">
				{m.auth_no_account()}{" "}
				<Link
					to="/signup"
					search={{ redirect: search.redirect }}
					className="text-indigo-400 hover:underline"
				>
					{m.auth_signup_link()}
				</Link>
			</p>
		</AuthShell>
	);
}

function AuthShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
			<div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 backdrop-blur">
				<Link
					to="/"
					className="mb-8 block text-center text-lg font-semibold tracking-tight text-white"
				>
					resmio
				</Link>
				{children}
			</div>
		</div>
	);
}

function AuthField({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: input arrives as children and nests inside the label at runtime
		<label className="block">
			<span className="mb-1.5 block text-sm font-medium text-neutral-300">
				{label}
			</span>
			{children}
		</label>
	);
}

export { AuthShell, AuthField };
