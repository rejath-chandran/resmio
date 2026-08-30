import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text(),
	// "user" | "admin" — see src/lib/auth-functions.ts for ADMIN_EMAILS bootstrap.
	role: text().notNull().default("user"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
	id: text().primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text().notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text().primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp",
	}),
	scope: text(),
	password: text(),
	issuer: text(),
	// ponytail: better-auth 1.5 account columns — drop when upgrading auth schema via CLI
	providerAccountId: text("provider_account_id"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
	id: text().primaryKey(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/** Resume templates: a layout engine id (code) + a theme (data). */
export const templates = sqliteTable("templates", {
	id: text().primaryKey(),
	name: text().notNull(),
	description: text().notNull().default(""),
	layout: text().notNull(),
	theme: text().notNull().default("{}"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const resumes = sqliteTable("resumes", {
	id: text().primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	title: text().notNull(),
	template: text().notNull().default("modern"),
	data: text().notNull().default("{}"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/** Hosted portfolio sites. One row per published `<subdomain>.resmio.in`. Files live on
 * the EC2 box (served by Caddy); this table is the app's index + ownership record. */
export const sites = sqliteTable("sites", {
	id: text().primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	subdomain: text().notNull().unique(),
	title: text().notNull().default(""),
	sizeBytes: integer("size_bytes").notNull().default(0),
	fileCount: integer("file_count").notNull().default(0),
	// 'live' | 'disabled' (admin takedown)
	status: text().notNull().default("live"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/* ---------- Billing ---------- */

/** Purchasable plans. Prices/durations are admin-editable (see admin-functions). */
export const plans = sqliteTable("plans", {
	id: text().primaryKey(),
	name: text().notNull(),
	// Whole rupees (₹499). Cashfree order_amount is a decimal — we send priceInr.
	priceInr: integer("price_inr").notNull(),
	currency: text().notNull().default("INR"),
	durationDays: integer("duration_days").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/** A user's access window. Pro = a row with status 'active' and periodEnd > now. */
export const subscriptions = sqliteTable("subscriptions", {
	id: text().primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	planId: text("plan_id").notNull(),
	// 'active' | 'expired' | 'cancelled'
	status: text().notNull().default("active"),
	currentPeriodEnd: integer("current_period_end", {
		mode: "timestamp",
	}).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/** One Cashfree order. `id` doubles as the Cashfree order_id we supply. */
export const payments = sqliteTable("payments", {
	id: text().primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	planId: text("plan_id").notNull(),
	// Rupees charged, snapshotted at checkout so later price edits don't rewrite history.
	amount: integer().notNull(),
	currency: text().notNull().default("INR"),
	// 'created' | 'paid' | 'failed'
	status: text().notNull().default("created"),
	cfOrderId: text("cf_order_id"),
	paymentSessionId: text("payment_session_id"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

/** Per-day AI call counter — enforces the free-tier daily cap. */
export const aiUsage = sqliteTable(
	"ai_usage",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// UTC date 'YYYY-MM-DD'.
		day: text().notNull(),
		count: integer().notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.userId, t.day] })],
);
