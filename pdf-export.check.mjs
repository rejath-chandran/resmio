// Self-check for PDF export: filename rules, auth, and that the PDF is NOT blank.
// Run with the dev server up: node ./pdf-export.check.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

// 1. safeFileName rules (mirrors src/lib/pdf-export.ts)
const INVALID = /[\\/:*?"<>|]/g;
const safeFileName = (t) =>
	t.trim().replace(INVALID, "_").replace(/\s+/g, " ") || "resume";
assert.equal(
	safeFileName('Senior Dev: "Backend"/2024'),
	"Senior Dev_ _Backend__2024",
);
assert.equal(safeFileName("   "), "resume");
assert.equal(safeFileName("a\t\tb"), "a b");

const browser = await chromium.launch();
const page = await browser.newPage();

// 2. Unauthenticated POST must be rejected
const anon = await page.request.post(`${BASE}/api/pdf`, {
	data: { content: "<p>x</p>", styles: "" },
});
assert.equal(anon.status(), 401, "anonymous export should be 401");

// 3. Sign in and open a resume with real content
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[type="text"]', "PDF Check");
await page.fill('input[type="email"]', `pdf-${Date.now()}@test.dev`);
await page.fill('input[type="password"]', "password123");
await page.getByRole("button", { name: /Create account/i }).click();
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.getByRole("button", { name: /New resume/i }).first().click();
await page.waitForURL("**/dashboard/**", { timeout: 15000 });
await page.getByLabel("Full name").fill("Alex Example");
await page.getByLabel("Professional summary").fill("Built and shipped things.");

// 4. Bad payloads are rejected, not rendered
const bad = await page.request.post(`${BASE}/api/pdf`, {
	data: { content: 42 },
});
assert.equal(bad.status(), 400, "non-string content should be 400");

// 5. The exact payload the client sends must stay VISIBLE under print media.
//    This is the regression that produced blank PDFs.
const payload = await page.evaluate(async () => {
	const styles = Array.from(document.styleSheets)
		.map((s) => {
			try {
				return Array.from(s.cssRules)
					.map((r) => r.cssText)
					.join("\n");
			} catch {
				return "";
			}
		})
		.join("\n");
	return { content: document.getElementById("resume-sheet").outerHTML, styles };
});
assert.match(payload.content, /Alex Example/, "payload must carry the content");

const probe = await browser.newPage();
await probe.emulateMedia({ media: "print" });
await probe.setContent(
	`<!doctype html><html><head><meta charset="utf-8"><style>${payload.styles}</style></head><body>${payload.content}</body></html>`,
);
const ink = await probe.evaluate(() => {
	const el = [...document.querySelectorAll("*")].find((n) =>
		[...n.childNodes].some(
			(c) => c.nodeType === 3 && c.textContent.includes("Alex Example"),
		),
	);
	if (!el) return { found: false };
	const cs = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	return {
		found: true,
		visibility: cs.visibility,
		display: cs.display,
		opacity: cs.opacity,
		color: cs.color,
		w: r.width,
		h: r.height,
	};
});
assert.ok(ink.found, "name text node missing from print render");
assert.equal(ink.visibility, "visible", "text hidden under @media print");
assert.notEqual(ink.display, "none");
assert.notEqual(ink.opacity, "0");
assert.notEqual(ink.color, "rgb(255, 255, 255)", "white-on-white text");
assert.ok(ink.w > 0 && ink.h > 0, `zero-size text box: ${JSON.stringify(ink)}`);
await probe.close();

// 6. Real export returns a PDF that is materially bigger than an empty sheet,
//    which is what a blank render collapses to.
const post = (data) => page.request.post(`${BASE}/api/pdf`, { data });
const full = await post(payload);
assert.equal(full.status(), 200, `expected 200, got ${full.status()}`);
assert.match(full.headers()["content-type"], /application\/pdf/);
const fullBody = await full.body();
assert.equal(fullBody.subarray(0, 5).toString(), "%PDF-", "not a PDF");

const empty = await post({
	content: '<div class="resume-sheet"></div>',
	styles: payload.styles,
});
const emptyBody = await empty.body();
assert.ok(
	fullBody.length > emptyBody.length * 1.2,
	`PDF looks blank: filled ${fullBody.length}b vs empty ${emptyBody.length}b`,
);

// 7. The button produces a .pdf download
const download = await Promise.all([
	page.waitForEvent("download", { timeout: 60000 }),
	page.getByRole("button", { name: /Download PDF/i }).click(),
]).then(([d]) => d);
assert.match(download.suggestedFilename(), /\.pdf$/);

await browser.close();
console.log(
	`pdf-export check: all assertions passed (filled ${fullBody.length}b vs empty ${emptyBody.length}b)`,
);
