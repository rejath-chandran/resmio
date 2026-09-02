import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db";
import * as schema from "#/db/schema";

// On Workers, env is only populated per-request — process.env is empty at module
// scope, where `auth` is constructed. Read every value from the cloudflare:workers
// `env` proxy, which IS available at module scope.
// ponytail: providers only register when their env pair is set — missing creds
// silently omit that button's backend. Add more providers the same way.
function socialProviders() {
	const p: Record<string, { clientId: string; clientSecret: string }> = {};
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		p.google = {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		};
	}
	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		p.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		};
	}
	return p;
}

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: socialProviders(),
	plugins: [tanstackStartCookies()],
});
