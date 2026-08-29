import { chromium } from "playwright";

// Responsive check for the builder page. Run against a dev server:
//   OPENAI_API_KEY="" npm run dev &  → node ./responsive.check.mjs
// Asserts no horizontal overflow across phone/tablet/desktop widths and that the
// mobile "Preview" toggle opens the full-screen overlay.
const BASE = "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") =>
	results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Sign up + open a fresh builder (mirrors e2e-smoke.mjs).
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[type="text"]', "Resp User");
await page.fill('input[type="email"]', `resp-${Date.now()}@test.dev`);
await page.fill('input[type="password"]', "password123");
await page.getByRole("button", { name: /Create account/i }).click();
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.getByRole("button", { name: /New resume/i }).first().click();
await page.waitForURL("**/dashboard/**", { timeout: 15000 });
// Give it some content so the sheet has real height.
await page.getByLabel("Full name").fill("Alex Example");
await page
	.getByLabel("Professional summary")
	.fill("Senior engineer shipping data-heavy apps for eight years.");
await page.waitForTimeout(800);

const noHOverflow = async () => {
	const { sw, iw } = await page.evaluate(() => ({
		sw: document.documentElement.scrollWidth,
		iw: window.innerWidth,
	}));
	return { ok: sw <= iw + 1, extra: `scrollWidth=${sw} inner=${iw}` };
};

for (const [label, w, h] of [
	["phone 375", 375, 812],
	["tablet 768", 768, 1024],
	["laptop 1280", 1280, 800],
	["desktop 1536", 1536, 900],
]) {
	await page.setViewportSize({ width: w, height: h });
	await page.waitForTimeout(250);
	const { ok, extra } = await noHOverflow();
	check(`no horizontal overflow @ ${label}`, ok, extra);
}

// Below lg: the Preview button shows and opens the overlay; the inline sheet is hidden.
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(200);
const previewBtn = page.getByRole("button", { name: /Preview/i });
check("preview button visible on phone", await previewBtn.isVisible().catch(() => false));
await previewBtn.click();
await page.waitForTimeout(200);
check(
	"preview overlay opens on phone",
	await page.locator(".resume-sheet-zoom-overlay .resume-sheet").isVisible().catch(() => false),
);
const stillFits = await noHOverflow();
check("overlay open keeps no h-overflow @ phone", stillFits.ok, stillFits.extra);

// On desktop the inline sticky preview is visible and the Preview button is not.
await page.setViewportSize({ width: 1536, height: 900 });
await page.waitForTimeout(250);
check(
	"inline preview visible on desktop",
	await page.locator(".resume-sheet-zoom #resume-sheet").isVisible().catch(() => false),
);
check(
	"preview button hidden on desktop",
	!(await page.getByRole("button", { name: /Preview/i }).isVisible().catch(() => false)),
);

await browser.close();
console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
