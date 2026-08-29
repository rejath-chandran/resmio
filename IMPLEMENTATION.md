# Resmio — Implementation Log

AI resume builder SaaS on TanStack Start. This file is the resume point: read it
first when picking the project back up, and append to it as work lands.

**How to update:** add a dated entry under [Changelog](#changelog) (newest last),
and edit [Current state](#current-state) so it always describes *now*, not history.

---

## Run it

```bash
npm run dev                    # http://localhost:3000
node ./e2e-smoke.mjs           # 18 UI checks, needs dev server up
node ./pdf-export.check.mjs    # PDF export self-check, needs dev server up
npx tsx ./billing.check.mjs    # webhook-signature + period-math self-check (no network)
npm run build && npx tsc --noEmit && npx biome check src
```

Env in `.env.local` (template: `.env.example`) — `DATABASE_URL` (default `dev.db`),
`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (**set a real secret before deploying**),
`OPENAI_API_KEY`, optional `OPENAI_BASE_URL` / `OPENAI_MODEL`, and for billing
`CASHFREE_ENV` (`sandbox`|`production`), `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`
(server-only — never in the client bundle). Billing degrades gracefully when unset.

Seed the Pro plan once after `db:push`: `npm run db:seed:plans`. Webhook endpoint for
Cashfree config: `POST {BETTER_AUTH_URL}/api/cashfree/webhook`.

Schema changes: `npm run db:push`. Message changes: recompile paraglide with
`npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide`.
New/moved routes: `npx tsr generate`.

## Stack

TanStack Start 1.170 (Vite 8) · SQLite via drizzle + better-sqlite3 · better-auth 1.5
· Tailwind v4 · zustand · framer-motion · paraglide v2 (en/de) · Biome · Playwright

Decisions made with the user: AI provider is **OpenAI-compatible over `fetch`** (no SDK),
DB is a **local file**, billing is **Cashfree** (Indian PG) selling one admin-editable
**Pro plan** (₹499 / 60 days).

## Current state

Feature-complete and green: `npm run build` ✓, `tsc` ✓, `biome` ✓,
e2e-smoke **18/18**, pdf-export check passing, `billing.check.mjs` passing.

| Area | Where | Notes |
|---|---|---|
| Landing | `src/routes/index.tsx`, `src/components/landing/` | hero, features, how-it-works, pricing, testimonials, footer; framer-motion `whileInView`; SEO via `head()` |
| Auth | `src/lib/auth.ts`, `routes/login.tsx`, `signup.tsx`, `routes/api/auth/$.ts` | better-auth email/password, drizzle adapter, `tanstackStartCookies()` |
| Route guard | `src/routes/_authenticated.tsx` | `beforeLoad` → `/login?redirect=`; children live in `_authenticated/` |
| Dashboard | `_authenticated/dashboard.index.tsx` | card grid, per-template mini previews, create/delete; free resume cap banner links to billing |
| Builder | `_authenticated/dashboard.$resumeId.tsx`, `components/builder/editor.tsx` | basics/experience/education/skills, AI improve; Pro templates locked for free |
| Autosave | `src/lib/builder-store.ts` | zustand + 800ms debounce; route injects the persister via `setPersister` |
| Preview | `components/resume-preview/templates.tsx` | modern / classic / minimal, pure components |
| PDF export | `src/lib/pdf-export.ts` + `src/routes/api/pdf.ts` | client clones `#resume-sheet` + page CSS → server renders with headless Chromium |
| AI | `src/lib/ai-functions.ts` | OpenAI-compatible `chat/completions`; heuristic fallback; free tier capped/day |
| Billing | `src/lib/billing-functions.ts`, `billing-settle.ts`, `cashfree.ts`, `entitlements.ts`, `routes/_authenticated/dashboard.billing.tsx`, `routes/api/cashfree.webhook.ts` | Cashfree checkout + webhook + return-verify; server-verified entitlements; admin-editable plans at `/admin/plans` |
| i18n | `messages/{en,de}.json`, `src/start.ts`, `src/router.tsx` | paraglide `url` strategy; `/de/…` works (admin/billing copy is English-only) |

### Deliberate simplifications (`ponytail:` comments in code)

- **One Chromium launch per PDF request** (`routes/api/pdf.ts`) — pool or move to a
  worker when exports become concurrent.
- **`issuer` / `provider_account_id` columns hand-added** to the account table
  (`src/db/schema.ts:55`) — drop when regenerating schema via the better-auth CLI.
- **Only session fetch is exposed** as a server fn (`src/lib/auth-functions.ts`) —
  user mutations stay internal to better-auth until a settings page exists.
- **Single-page A4 export** — no pagination markers; add when resumes overflow one page.
- **Free caps are constants** (`FREE_RESUME_LIMIT=2`, `FREE_AI_CALLS_PER_DAY=10` in
  `src/lib/entitlements.ts`) — lift into the `plans` table if tiers ever diverge.
- **Customer phone is a placeholder** (`"9999999999"` in `createCheckout`) — Cashfree
  requires one and the user model has no phone field yet.

### Known risks / not done

- `BETTER_AUTH_SECRET` is empty in `.env.local` — must be set before any deploy.
- AI path only exercised via the fallback; never tested against a live API key.
- Playwright is a **runtime** dependency (the PDF route imports it) and is excluded
  from the Vite bundle graph in `vite.config.ts` — see 2026-08-29 entry for why.
- No rate limit on `/api/pdf` beyond the session check and 2MB body cap.

---

## Changelog

### 2026-08-28 — build-out

Implemented the plan end to end on the TanStack Start starter: design tokens in
`src/styles.css`, landing page, better-auth signup/login, dashboard, builder with
autosave, three preview templates, AI improve with local fallback, en/de messages.
Wrote `e2e-smoke.mjs` (Playwright, 18 checks) as the runnable check.

Things that cost time, so they don't cost it twice:

- This version exports from `@tanstack/react-start`, **not** `@tanstack/start`.
- `getRequest` comes from `@tanstack/start-server-core/request-response`.
- A pathless layout (`_authenticated.tsx`) **must** have children in a matching
  folder, or `tsr generate` errors with "Conflicting configuration paths".
- `dashboard.tsx` as a parent layout without `<Outlet/>` silently swallowed the
  builder route → renamed to `dashboard.index.tsx` so list and builder are siblings.
- better-auth 1.5 signup 500s without `issuer` + `provider_account_id` on `account`.
  A failed signup can leave an orphaned user row; clear it when retrying.

### 2026-08-29 — German locale (`/de` 404)

paraglide's `url` strategy needs the router to map localized URLs to route paths;
the request middleware alone isn't enough. Fixed with `rewrite` in
`src/router.tsx` (`input: deLocalizeUrl`, `output: localizeUrl`), leaving
`src/start.ts` to do locale detection only. `next()` in request middleware takes
no `request` option, so don't try to pass the delocalized request through it.
e2e-smoke went 18/18.

### 2026-08-29 — server-rendered PDF export

Replaced `window.print()` with the clone-markup-and-render-server-side strategy:
`src/lib/pdf-export.ts` clones `#resume-sheet`, serializes every readable
stylesheet, POSTs to `/api/pdf`; `src/routes/api/pdf.ts` renders it with headless
Chromium (`page.pdf({ format: "A4", printBackground: true })`) and streams the PDF
back. Filenames sanitized via `safeFileName`.

Because that route accepts HTML from a request, it is session-gated (401 anonymous),
caps the body at 2MB (413), type-checks `content`/`styles` (400), and aborts **all**
outbound requests from the render page so submitted markup can't make the server
fetch anything. Added `builder_exporting` / `builder_export_failed` messages plus an
inline error state on the button.

Vite couldn't optimize `playwright` — it tried to parse `fsevents.node` and died with
`stream did not contain valid UTF-8`. Fixed by marking it SSR-external and excluding
it from `optimizeDeps` in `vite.config.ts`; it's server-only and never belonged in the
client graph.

### 2026-08-29 — blank PDF fix

Downloaded PDFs were blank. Cause was a CSS specificity bug in the print rules:

```css
body :not(.resume-sheet-print-root) * { visibility: hidden; }   /* (0,1,1) */
.resume-sheet-print-root * { visibility: visible; }             /* (0,1,0) — loses */
```

`:not()` contributes its argument's specificity, so the hide rule outranked the
un-hide rule on every descendant. The usual form of this trick uses bare `body *`
at `(0,0,1)`, which correctly loses; adding `:not()` inverted it. The on-screen
preview never exercises print media, so nothing caught it — and the old
`window.print()` path had the same latent bug.

Deleted the visibility hack entirely: the renderer receives a document containing
only the sheet, so there is nothing to hide. `@media print` now just sets page
geometry, with a warning comment at `src/styles.css:157` against reintroducing it.

`pdf-export.check.mjs` now renders the *exact* client payload under
`emulateMedia("print")` and asserts the name text is visible, non-zero-size and not
white-on-white, then asserts the real PDF is materially larger than an empty sheet.

Also, twice during this work the machine hit `ENOSPC` (228Gi volume, ~120Mi free)
and killed the dev server. `npm cache clean --force` reclaimed ~6.3GB but it refilled
within minutes — if the dev server dies unexplained, check `df -h /` and
`tmutil listlocalsnapshots /` first.

### 2026-08-29 — Cashfree payments + Pro subscription

Added billing end to end. Four tables (`plans`, `subscriptions`, `payments`,
`aiUsage`), a Cashfree v2023-08-01 client over plain `fetch` (`src/lib/cashfree.ts`),
entitlements (`src/lib/entitlements.ts`), and server fns (`src/lib/billing-functions.ts`).
Flow: `createCheckout` inserts a `payments` row and creates a Cashfree order → the
v3 SDK checkout (loaded via a dynamic `<script>`) → on return `confirmPayment`
re-verifies the order server-side; a `POST /api/cashfree/webhook` does the same.
Both share **one race-safe idempotent settle** (`settlePaidOrder`: conditional
`UPDATE payments SET status='paid' WHERE id=? AND status!='paid' RETURNING` — only
the winning row activates the subscription), so webhook vs return-verify grants Pro
exactly once. Webhook signature (base64 HMAC-SHA256 of `timestamp+rawBody`) is
verified before the payload is trusted (401 otherwise). Entitlements are enforced
server-side (Pro templates, `FREE_RESUME_LIMIT`, `FREE_AI_CALLS_PER_DAY`); the client
only mirrors the locks. Admins edit price/duration at `/admin/plans`; the dashboard
shows Pro-subscriber count + revenue. `billing.check.mjs` asserts signature verify +
period math with no network.

The one that cost time — and the reason `billing.check` + build + tsc + biome all
passed while the app was broken at runtime: **`billing-functions.ts` originally
`export`ed `settlePaidOrder` (a plain, non-server-fn helper that touches `db`).**
Because `dashboard-header.tsx` imports `getBillingState` from that same module, Vite
kept the exported db-touching helper in the **client** bundle (server-fn *handler
bodies* get stripped, but an exported module-scope function referencing `db` cannot be
tree-shaken). That pulled `drizzle-orm/better-sqlite3` into the browser, where
`util.promisify` is externalized → `TypeError: promisify is not a function`, logged
by the dev server on **every** dashboard render. The retry storm wrote a **20 GB**
dev log that filled the disk and killed the server — which is why e2e-smoke flaked at
"New resume" (dashboard never mounted) with no obvious cause.

Fix: moved `settlePaidOrder` + `activateSubscription` into a new server-only module
`src/lib/billing-settle.ts`, imported statically by the webhook route and via a
**dynamic `import()` inside the `confirmPayment` handler**. `billing-functions.ts` now
exports only server fns, so it's client-safe — same rule as `src/lib/roles.ts`. Lesson:
a server-fn file that any client component imports must export *only* server fns; any
plain `db`-touching helper belongs in a separate server-only module. e2e-smoke back to
18/18. (If the dev log ever balloons again, `ls -lh` the log and `df -h /` before
anything else — a client-bundle db leak is the likely cause.)

### 2026-08-30 — Projects & Links sections (+ AI on project descriptions)

Added two new resume sections to the model and builder.

- **Model** (`src/lib/resume-schema.ts`): `projects[]` `{id,name,url,description}`
  and `links[]` `{id,label,url}`; added to `emptyResume()` and validated by new
  `parseProjects` (cap 20; name≤120, url≤200, desc≤600) / `parseLinks` (cap 15;
  label≤60, url≤200). Store default (`builder-store.ts`) seeds both as `[]`.
- **Render** (`resume-preview/shared.tsx` + `layouts.tsx`): new `ProjectsList`
  component and `contactWithLinks(data)` helper (contact line + link URLs). All 8
  layouts now render a Projects `<Sec>` after Experience (per-layout variant) and use
  `contactWithLinks`; `contactList` is now only used internally by the helper.
- **Editor** (`components/builder/editor.tsx`): `ProjectsSection` (name/url fields +
  description textarea with the existing `AiImproveButton kind="summary"`) and
  `LinksSection` (label/url, add/remove). Wired into `dashboard.$resumeId.tsx`.
- **i18n**: added `builder_projects/_add_project/_project_name/_project_desc/
  _links/_add_link/_link_label/_link_url` to `messages/en.json` + `de.json`; recompiled
  paraglide. Sample resume (`sample-resume.ts`) gained a project + two links for preview.

Verify: `npx tsc --noEmit`, `npx biome check src`, `npm run build` all green.
`node ./e2e-smoke.mjs` = **18/18** when run against a dev server with no
`OPENAI_API_KEY` (the "ai fallback rewrite" check asserts the local `worked on`→
`developed` rewrite; with a real key set in `.env.local` the model returns a different
rewrite and that one check reads 17/18 — an env condition, not a regression).

### 2026-08-30 — Sticky (floating) preview in the builder

The preview column now stays pinned while the editor scrolls on `lg+`
(`dashboard.$resumeId.tsx`): `lg:sticky lg:top-[57px] self-start` on the
`resume-sheet-print-root` wrapper, and — the part that actually mattered —
**`overflow-auto` was removed from the body row**. An `overflow-*` ancestor becomes the
sticky scroll port, so the sheet was sticking to a container that never scrolled while
the window did. Verified with Playwright: the sheet's `top` stays at 57px after a 1200px
window scroll.

### 2026-08-30 — ATS checker (Pro)

Live 0–100 ATS score beside the preview, with suggestions and optional job-description
keyword matching. Heuristic runs client-side (instant, every keystroke); the AI review is
a Pro-gated server fn.

- **Scorer** (`src/lib/ats.ts`, pure/client-safe — no `db` imports): `computeAtsReport(data, jobDescription?)`
  → `{ score, categories, suggestions, missingKeywords }`. Rubric sums to 100 — contact 15,
  summary 10, experience 15, bullets 20 (quantified `/\d|%/` + action-verb opener), skills 10,
  education 5, links 5, formatting 10, keyword match 10 (full credit when no JD, so the base
  score stays meaningful). Each sub-max category emits one concrete suggestion. Also exports
  `atsBand(score)` (<50 low / <80 mid / else high) and `resumeToText(data)`, reused by the AI call.
- **AI review** (`src/lib/ats-functions.ts`): `atsReview` server fn only (client-bundle rule —
  see `src/lib/roles.ts`); `isProUser` is dynamically imported inside the handler and throws a
  friendly upgrade error for free users. OpenAI over `fetch` (same env as `ai-functions.ts`),
  asks for a JSON array of 3–6 suggestions, `parseSuggestions` tolerates non-JSON. No key /
  non-OK / throw → `{ suggestions: [], source: "fallback" }`, so the heuristic tips still show.
- **UI** (`src/components/builder/ats-panel.tsx`): conic-gradient gauge, per-category bars,
  suggestions, JD textarea (local state → scorer), missing-keyword list, "✦ AI suggestions"
  button via `useServerFn`. Non-pro renders a blurred body + billing CTA.
- **Toolbar** (`dashboard.$resumeId.tsx`): live colored score chip toggles the panel as a third
  sticky column; free users get `🔒 ATS` linking to `/dashboard/billing`.
- **i18n**: `ats_*` keys in `messages/en.json` + `de.json`, paraglide recompiled.

Note: the client heuristic can't be hidden from a determined user (same model as the
template lock) — the **AI endpoint is server-enforced**.

Verify: `npx tsx ./ats.check.mjs` → `PASS ats.check — empty=13 full=95`; `npx tsc --noEmit`,
`npx biome check src`, `npm run build` green; `node ./e2e-smoke.mjs` **18/18** against a dev
server started with `OPENAI_API_KEY=""`.

### 2026-08-30 — Responsive builder (phone / tablet / desktop)

Made `/dashboard/$resumeId` responsive. Root cause of the old breakage: the A4 sheet is
`width: 210mm` (~794px) and `transform: scale` only shrank it *visually* while still
reserving 794px → horizontal scroll; and editor + preview + ATS made three inline columns
that overflowed laptops.

- **Preview scaling via `zoom`** (`src/styles.css`): new `.resume-sheet-zoom` (inline desktop:
  `.62`→`.78`@1280→`1`@1536) and `.resume-sheet-zoom-overlay` (mobile: `.45`→`.7`@640→`.9`@768).
  `zoom` shrinks the *layout footprint* (unlike `transform: scale`), which is what removes the
  overflow. `ponytail:` needs evergreen browser (Firefox ≥126); legacy path noted in CSS.
- **Route** (`dashboard.$resumeId.tsx`): inline preview is now `hidden lg:block` + `.resume-sheet-zoom`
  (keeps its `id="resume-sheet"` for PDF export). Below `lg`, a **Preview** toolbar button
  (`lg:hidden!` — the `!` beats `.btn-ghost{display:inline-flex}`) opens a full-screen overlay
  copy (id-less). Body padding `p-4 sm:p-6`; title input `min-w-0` so the toolbar never overflows.
- **ATS panel → drawer**: no longer a third inline column; renders as a fixed right drawer
  (`fixed right-0 top-[57px] bottom-0 max-w-sm`) with a `lg:hidden` backdrop. `AtsPanel` gained an
  optional `onClose` + ✕ button (`src/components/builder/ats-panel.tsx`).
- **Editor cards**: `card p-6` → `card p-4 sm:p-6`; grids were already `sm:grid-cols-2`.
- **i18n**: added `builder_preview` (en/de), recompiled paraglide.

Gotcha: custom component classes that set `display` (`.btn-ghost`) override Tailwind's
`lg:hidden` at equal specificity — use the `!` important variant to hide them at a breakpoint.

Verify: new `responsive.check.mjs` (Playwright) → **9/9** — no horizontal overflow at
375/768/1280/1536, Preview button shows <lg and opens the overlay, inline preview shows on
desktop with the button hidden. `npx tsc --noEmit`, `npx biome check src`, `npm run build`
green; `node ./e2e-smoke.mjs` **18/18** (blank `OPENAI_API_KEY`; one cold-start flake that
passes on warm rerun).
