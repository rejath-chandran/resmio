import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const { db } = await import("./index.ts");
const { plans } = await import("./schema.ts");

/**
 * Built-in plans. Re-runnable: `onConflictDoNothing` leaves admin price/duration
 * edits alone. Admins change these later from /admin/plans.
 */
const BUILT_INS = [
	{
		id: "pro",
		name: "Pro",
		priceInr: 499,
		currency: "INR",
		durationDays: 60, // 2 months
		isActive: true,
	},
];

const rows = await db
	.insert(plans)
	.values(BUILT_INS)
	.onConflictDoNothing()
	.returning({ id: plans.id });

console.log(
	`seeded ${rows.length} of ${BUILT_INS.length} plans${
		rows.length ? `: ${rows.map((r) => r.id).join(", ")}` : " (already present)"
	}`,
);
