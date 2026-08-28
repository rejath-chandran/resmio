import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") => {
	results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1. Landing page
await page.goto(BASE, { waitUntil: "networkidle" });
check("landing renders", await page.locator("text=Start building free").first().isVisible());
check("landing features section", await page.locator("#features").isVisible());
check("landing pricing section", await page.locator("#pricing").isVisible());
check("landing testimonials", await page.locator("text=Sarah K.").isVisible());

// 2. Locale switch to DE (full navigation via paraglide url strategy)
await page.getByRole("button", { name: "DE", exact: true }).click();
await page.waitForLoadState("networkidle");
check("german locale", await page.locator("text=Kostenlos starten").first().isVisible({ timeout: 10000 }));
await page.goto(BASE, { waitUntil: "networkidle" });

// 3. Signup flow
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[type="text"]', "E2E User");
await page.fill('input[type="email"]', `e2e-${Date.now()}@test.dev`);
await page.fill('input[type="password"]', "password123");
await page.getByRole("button", { name: /Create account/i }).click();
await page.waitForURL("**/dashboard", { timeout: 15000 });
check("signup redirects to dashboard", page.url().includes("/dashboard"));

// 4. Dashboard empty state
// Wait for the state, don't sleep at it — a cold dev-mode chunk compile can take
// several seconds and a fixed timeout made this flake.
const emptyVisible = await page
	.locator("text=No resumes yet")
	.waitFor({ timeout: 15000 })
	.then(() => true)
	.catch(() => false);
check("dashboard empty state", emptyVisible);

// 5. Create resume
await page.getByRole("button", { name: /New resume/i }).first().click();
await page.waitForURL("**/dashboard/**", { timeout: 15000 });
check("create resume opens builder", /\/dashboard\/[a-zA-Z0-9-]+$/.test(page.url()));

// 6. Builder: fill basics, watch preview
await page.fill('input[aria-label="Resume title"]', "Senior Dev Role");
await page.getByLabel("Full name").fill("Alex Example");
await page.getByLabel("Professional summary").fill("I worked on lots of stuff and made things. Helped teams.");
await page.waitForTimeout(1500); // autosave debounce + save
check("autosave indicator", await page.locator("text=All changes saved").isVisible().catch(() => false));
check("preview shows name", await page.locator(".resume-sheet >> text=Alex Example").first().isVisible().catch(() => false));

// 7. Add experience + bullet
await page.getByRole("button", { name: /Add experience/i }).click();
await page.getByLabel("Role").first().fill("Backend Engineer");
await page.getByLabel("Company").first().fill("Acme");
await page.getByRole("button", { name: "+ bullet" }).click();
await page.waitForTimeout(1200);
check("preview shows role", await page.locator(".resume-sheet >> text=Backend Engineer").first().isVisible().catch(() => false));

// 8. Skills tag
await page.getByPlaceholder("Add skill").fill("TypeScript");
await page.getByPlaceholder("Add skill").press("Enter");
check("skill chip appears", await page.locator("text=TypeScript").first().isVisible());

// 9. Template switch changes preview (classic = serif)
await page.selectOption("select", "classic");
await page.waitForTimeout(400);
const serif = await page.locator(".resume-sheet .font-serif").count();
check("classic template applies", serif > 0);

// 10. AI improve (fallback mode — no key set)
await page.selectOption("select", "modern");
const improveBtn = page.getByRole("button", { name: /Improve with AI/i }).first();
if (await improveBtn.isVisible().catch(() => false)) {
	await improveBtn.click();
	await page.waitForTimeout(3000);
	const improved = await page.locator(".resume-sheet >> text=developed").first().isVisible().catch(() => false);
	check("ai fallback rewrite", improved);
}

// 11. Reload — persistence
await page.reload({ waitUntil: "networkidle" });
check("title persisted", (await page.inputValue('input[aria-label="Resume title"]')) === "Senior Dev Role");
check("name persisted", (await page.getByLabel("Full name").inputValue()) === "Alex Example");

// 12. Back to dashboard — card present
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("dashboard lists resume", await page.locator("text=Senior Dev Role").first().isVisible());

// 13. Sign out → guard kicks in
await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(1500);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
check("auth guard after signout", page.url().includes("/login"));

await browser.close();
console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
