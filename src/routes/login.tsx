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
	head: () => ({
		meta: [{ name: "robots", content: "noindex, follow" }],
	}),
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
			<SocialButtons redirect={search.redirect} />
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

export { AuthShell, AuthField, SocialButtons };

function SocialButtons({ redirect }: { redirect: string }) {
	const [pending, setPending] = useState<"google" | "github" | null>(null);
	async function go(provider: "google" | "github") {
		setPending(provider);
		await authClient.signIn.social({ provider, callbackURL: redirect });
	}
	return (
		<>
			<div className="my-6 flex items-center gap-3">
				<span className="h-px flex-1 bg-neutral-800" />
				<span className="text-xs uppercase tracking-wide text-neutral-500">
					{m.auth_or()}
				</span>
				<span className="h-px flex-1 bg-neutral-800" />
			</div>
			<div className="space-y-3">
				<button
					type="button"
					disabled={pending !== null}
					onClick={() => go("google")}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
				>
					<GoogleIcon />
					{m.auth_continue_google()}
				</button>
				<button
					type="button"
					disabled={pending !== null}
					onClick={() => go("github")}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
				>
					<GitHubIcon />
					{m.auth_continue_github()}
				</button>
			</div>
		</>
	);
}

function GoogleIcon() {
	return (
		<svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 4.75 12 4.75Z"
			/>
		</svg>
	);
}

function GitHubIcon() {
	return (
		<svg
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
		</svg>
	);
}
