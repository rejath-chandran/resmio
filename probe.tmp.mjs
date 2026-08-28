import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto("http://localhost:3000/login?redirect=%2Fdashboard", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "admin-check@test.dev");
await p.fill('input[type="password"]', "password123");
await p.getByRole("button", { name: /^Log in$/i }).click();
await p.waitForURL("**/dashboard", { timeout: 20000 });
const out = await p.evaluate(async () => {
  const mod = await import("/src/lib/admin-functions.ts");
  const stats = await mod.adminStats().then(r => JSON.stringify(r).slice(0,140), e => "ERR " + e.message);
  const users = await mod.listUsers({ data: { q: "admin", page: 0 } }).then(r => JSON.stringify(r).slice(0,140), e => "ERR " + e.message);
  return { stats, users };
});
console.log(out);
await b.close();
