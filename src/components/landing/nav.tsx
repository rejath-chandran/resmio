import { Link } from "@tanstack/react-router";

import LocaleSwitcher from "#/components/LocaleSwitcher";
import { m } from "#/paraglide/messages";

export function Logo({ className = "" }: { className?: string }) {
	return (
		<Link
			to="/"
			className={`font-display text-lg font-bold tracking-tight text-white ${className}`}
		>
			CV<span className="text-violet-400">ATS</span>
			<span className="text-brand-400">Friendly</span>
			<span className="text-brand-400">.</span>
		</Link>
	);
}

export function Nav({ authed }: { authed: boolean }) {
	return (
		<header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-800/60 bg-neutral-950/70 backdrop-blur-md">
			<nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<div className="flex items-center gap-8">
					<Logo />
					<div className="hidden items-center gap-6 md:flex">
						<a
							href="#features"
							className="text-sm text-neutral-400 transition-colors hover:text-white"
						>
							{m.nav_features()}
						</a>
						<a
							href="#how"
							className="text-sm text-neutral-400 transition-colors hover:text-white"
						>
							{m.nav_how_it_works()}
						</a>
						<a
							href="#pricing"
							className="text-sm text-neutral-400 transition-colors hover:text-white"
						>
							{m.nav_pricing()}
						</a>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<LocaleSwitcher />
					{authed ? (
						<Link to="/dashboard" className="btn-primary">
							{m.nav_dashboard()}
						</Link>
					) : (
						<>
							<Link
								to="/login"
								search={{ redirect: "/" }}
								className="hidden text-sm font-medium text-neutral-300 transition-colors hover:text-white sm:block"
							>
								{m.nav_login()}
							</Link>
							<Link
								to="/signup"
								search={{ redirect: "/" }}
								className="btn-primary"
							>
								{m.nav_get_started()}
							</Link>
						</>
					)}
				</div>
			</nav>
		</header>
	);
}
