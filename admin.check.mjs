// Admin panel self-check. Run with the dev server up:
//   ADMIN_EMAILS=<seeded admin email> node ./admin.check.mjs
// The dev server must already have that email in ADMIN_EMAILS for promotion to
// happen; the script signs up a fresh non-admin to prove the negative cases.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_CHECK_EMAIL;
assert.ok(
	ADMIN_EMAIL,
	"set ADMIN_CHECK_EMAIL to an address listed in the server's ADMIN_EMAILS",
);

const browser = await chromium.launch();

/** Signs up a fresh account in its own context and returns the page. */
async function signUp(email, name) {
	const page = await (await browser.newContext()).newPage();
	await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
	await page.fill('input[type="text"]', name);
	await page.fill('input[type="email"]', email);
	await page.fill('input[type="password"]', "password123");
	await page.getByRole("button", { name: /Create account/i }).click();
	await page.waitForURL("**/dashboard", { timeout: 15000 });
	return page;
}

/**
 * Calls an admin server fn through its real client proxy and reports whether it
 * resolved. Going through the module means the id and seroval payload encoding
 * come from the framework rather than being guessed here — hand-built
 * /_serverFn/ URLs 500 on encoding, which looks like a passing auth check.
 *
 * ponytail: dev-server only, since it imports by source URL. That's fine — this
 * script already requires `npm run dev`. Point it at a build and it needs the
 * hashed chunk path instead.
 */
async function callFn(page, name, payload) {
	return page.evaluate(
		async ([fn, data]) => {
			const mod = await import("/src/lib/admin-functions.ts");
			try {
				const result = await mod[fn](data === null ? undefined : { data });
				return { ok: true, body: JSON.stringify(result ?? null) };
			} catch (e) {
				return { ok: false, body: String(e?.message ?? e) };
			}
		},
		[name, payload ?? null],
	);
}

/* ---------- 1. Non-admin is locked out ---------- */

const userPage = await signUp(`nonadmin-${Date.now()}@test.dev`, "Plain User");

await userPage.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
assert.ok(
	!userPage.url().includes("/admin"),
	`non-admin reached /admin (${userPage.url()})`,
);
assert.ok(
	!(await userPage.locator("text=Manage templates").isVisible().catch(() => false)),
	"admin UI rendered for a non-admin",
);

// The route guard only hides UI — the server fns must refuse independently.
await userPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
for (const fn of ["adminStats", "listUsers", "listAllTemplates"]) {
	const res = await callFn(userPage, fn, {});
	assert.ok(!res.ok, `${fn} answered a non-admin: ${res.body}`);
	assert.match(res.body, /Forbidden/, `${fn} refused for the wrong reason`);
}

// Admin link must not appear in the non-admin's header.
assert.equal(
	await userPage.getByRole("link", { name: "Admin", exact: true }).count(),
	0,
	"Admin nav link shown to a non-admin",
);

/* ---------- 2. ADMIN_EMAILS promotion ---------- */

let adminPage;
const adminCtx = await browser.newContext();
adminPage = await adminCtx.newPage();
// ?redirect: login's own default is "/", so ask for /dashboard explicitly.
await adminPage.goto(`${BASE}/login?redirect=%2Fdashboard`, {
	waitUntil: "networkidle",
});
await adminPage.fill('input[type="email"]', ADMIN_EMAIL);
await adminPage.fill('input[type="password"]', "password123");
await adminPage.getByRole("button", { name: /^Log in$/i }).click();
await adminPage
	.waitForURL("**/dashboard", { timeout: 15000 })
	.catch(async () => {
		// No such account yet — create it. ADMIN_EMAILS promotes on session fetch.
		adminPage = await signUp(ADMIN_EMAIL, "Admin User");
	});

await adminPage.reload({ waitUntil: "networkidle" });
assert.equal(
	await adminPage.getByRole("link", { name: "Admin", exact: true }).count(),
	1,
	"ADMIN_EMAILS did not promote — is the dev server started with it set?",
);

await adminPage.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
assert.ok(adminPage.url().includes("/admin"), "admin blocked from /admin");
assert.ok(
	await adminPage.locator("text=Template usage").isVisible(),
	"overview stats missing",
);

/* ---------- 3. Resume contents never cross the admin boundary ---------- */

// Give the non-admin a resume with a distinctive secret in its contents.
const SECRET = `secret-${Date.now()}`;
await userPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await userPage.getByRole("button", { name: /New resume/i }).first().click();
await userPage.waitForURL("**/dashboard/**", { timeout: 15000 });
await userPage.fill('input[aria-label="Resume title"]', "Admin Visible Title");
await userPage.getByLabel("Professional summary").fill(SECRET);
await userPage.waitForTimeout(1600); // autosave debounce

const usersRes = await callFn(adminPage, "listUsers", { q: "nonadmin", page: 0 });
assert.ok(usersRes.ok, `listUsers: ${usersRes.body}`);
assert.ok(!usersRes.body.includes(SECRET), "resume contents leaked via listUsers");

await adminPage.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
await adminPage.fill('input[aria-label="Search users"]', "nonadmin");
await adminPage.waitForTimeout(800);
assert.ok(
	await adminPage.locator("text=Admin Visible Title").isVisible().catch(() => false) ||
		(await adminPage.locator("text=nonadmin").first().isVisible()),
	"user row missing from search",
);
const pageText = await adminPage.locator("body").innerText();
assert.ok(!pageText.includes(SECRET), "resume contents rendered on admin screen");

/* ---------- 4. Template CRUD ---------- */

const NEW_ID = `check-${Date.now().toString(36)}`;
await adminPage.goto(`${BASE}/admin/templates/new`, { waitUntil: "networkidle" });
await adminPage.fill("#t-id", NEW_ID);
await adminPage.fill("#t-name", "Check Template");
await adminPage.selectOption("#t-layout", "editorial");
await adminPage.fill("#t-accent + input", "#00aa55");
await adminPage.getByRole("button", { name: /^Create$/ }).click();
await adminPage.waitForURL("**/admin/templates", { timeout: 15000 });
assert.ok(
	await adminPage.locator(`text=${NEW_ID}`).first().isVisible(),
	"created template missing from list",
);

// Duplicate id must be refused rather than silently overwriting.
const dup = await callFn(adminPage, "createTemplate", {
	id: NEW_ID,
	name: "Dup",
	layout: "modern",
	theme: {},
});
assert.ok(!dup.ok, "duplicate template id was accepted");

// Unknown layout must be refused — layouts are code, not free text.
const badLayout = await callFn(adminPage, "createTemplate", {
	id: `${NEW_ID}-x`,
	name: "Bad",
	layout: "does-not-exist",
	theme: {},
});
assert.ok(!badLayout.ok, "unknown layout was accepted");

// The new template reaches the user's builder dropdown and renders.
await userPage.reload({ waitUntil: "networkidle" });
await userPage.waitForTimeout(600);
await userPage.selectOption("select", NEW_ID);
await userPage.waitForTimeout(800);
const accentPainted = await userPage.evaluate(() =>
	[...document.querySelectorAll("#resume-sheet *")].some(
		(n) => getComputedStyle(n).backgroundColor === "rgb(0, 170, 85)",
	),
);
assert.ok(accentPainted, "new template's accent never rendered in the preview");

// In use → delete refused, deactivate allowed.
const delInUse = await callFn(adminPage, "deleteTemplate", NEW_ID);
assert.ok(!delInUse.ok, "deleted a template still in use");
const deactivate = await callFn(adminPage, "setTemplateActive", {
	id: NEW_ID,
	isActive: false,
});
assert.ok(deactivate.ok, `deactivate failed: ${deactivate.body}`);

// Move the resume off it, then the delete must succeed.
await userPage.selectOption("select", "modern");
await userPage.waitForTimeout(1600);
const delFree = await callFn(adminPage, "deleteTemplate", NEW_ID);
assert.ok(delFree.ok, `unused delete failed: ${delFree.body}`);

/* ---------- 5. Last-admin protection ---------- */

const adminRow = await callFn(adminPage, "listUsers", { q: ADMIN_EMAIL, page: 0 });
const adminId = JSON.parse(adminRow.body)?.users?.[0]?.id;
assert.ok(adminId, `could not resolve admin id from: ${adminRow.body}`);
const demote = await callFn(adminPage, "setUserRole", {
	id: adminId,
	role: "user",
});
assert.ok(!demote.ok, "demoted the last admin");

await browser.close();
console.log("admin check: all assertions passed");
