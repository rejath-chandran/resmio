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

### 2026-08-30 — AI Job Match (Pro) — phase 1: `job-worker/` ingestion service

Standalone dockerized scraper (not wired into the app yet — that's phase 2). Lives in
`job-worker/`, separate from the app: it owns a **Postgres+pgvector** store; the app will
read it read-only. Decisions with the user: **self-scrape, no third-party job API**;
Python + Scrapling toolchain; **Postgres+pgvector on EC2** (docker-compose); build the
scraper first. Feature is an **index, not auto-apply** — every job links out to the origin.

- **Sources = public ATS JSON first** (`worker/fetchers.py`): Greenhouse
  (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`) + Lever
  (`api.lever.co/v0/postings/{slug}?mode=json`). No HTML scraping / anti-bot / maintenance.
  Slugs curated in `companies.yaml` — growth = add slugs, not code. Scrapling is in
  `requirements.txt` for tier-2 HTML boards but **unused in v1**.
- **Normalize** (`worker/normalize.py`, pure/offline): raw → `Job`, tag-strip + entity
  decode, `make_id = sha1(source:external_id)`, Lever epoch-ms → ISO, `dedup` (last wins).
- **Embeddings** (`worker/embed.py`): fastembed `BAAI/bge-small-en-v1.5` (384-dim), local,
  **$0/embed**, cached to a docker volume. `job_text()` kept symmetric with the app's future
  `resumeToText()` so resume↔job vectors are comparable.
- **DB** (`worker/db.py` + `schema.sql`): `jobs` table with `embedding vector(384)`, ivfflat
  cosine index, `UNIQUE(source, external_id)`; `upsert_jobs` re-activates+re-stamps on
  conflict; `deactivate_missing` sweeps stale (no-op on empty run for safety).
- **Match** (`worker/match.py`): `1 - (embedding <=> vec)` cosine top-N — the reference query
  the app's server fn will mirror.
- **Loop** (`worker/main.py`): boot pass + APScheduler every `SCRAPE_INTERVAL_HOURS` (6).
- **Runnable check**: `python check_ingest.py` (stdlib only, no network/db/deps) → asserts
  normalize + dedup 3→2 + remote flags + id stability. **PASS**. All modules `py_compile` clean.

Phase 2 (done 2026-08-30, see below): app-side Pro-gated `dashboard.jobs.tsx` +
`src/lib/jobs-functions.ts` reading the EC2 store, embedding the resume via the worker shim,
ranking + optional LLM re-rank, degrading when `EC2_*` unset.

Security note in `job-worker/README.md`: never expose Postgres `5432` to `0.0.0.0` — restrict
to the app server IP in the EC2 security group.

### 2026-08-30 — Deployed job-worker to EC2 (phase 1)

Deployed `job-worker/` to EC2 `3.83.35.75` (Ubuntu 26.04 x86_64, `ubuntu` user, `job_runner.pem`).

- Installed Docker via `get.docker.com` (docker 29.7.2, compose v5.5.0); daemon enabled on boot,
  `ubuntu` added to the `docker` group.
- `rsync`'d `job-worker/` → `~/job-worker` (excluded `__pycache__`/`.env`).
- Generated `.env` on the host — `POSTGRES_PASSWORD` = fresh 48-hex-char `openssl rand`
  (chmod 600, never printed). Other keys default (user/db `jobs`, port 5432, interval 6h).
- `docker compose up -d --build`: `db` (pgvector/pgvector:pg16) healthy + `worker` up, both
  `restart=unless-stopped`. Boot pass ingested greenhouse feeds (stripe/airbnb/figma…),
  embedding local (bge-small, 384-dim); 512+ rows, all embedded.
- Verified `python -m worker.match "python backend engineer"` returns ranked jobs w/ apply links.

App wiring (phase 2): `EC2_JOBS_DATABASE_URL=postgresql://jobs:<pw>@3.83.35.75:5432/jobs`
(pw lives in `~/job-worker/.env` on the box).

**OPEN SECURITY ITEM — needs AWS console/CLI, not doable from the box:** compose publishes
`5432` on `0.0.0.0`. The EC2 security group must restrict `5432` ingress to the app server IP
only. Until then Postgres is internet-reachable (password-protected, but exposed).

### 2026-08-30 — AI Job Match (Pro) — phase 2: app wiring + embed shim

Wired the app to the EC2 job store and shipped the Pro-gated jobs page.

- **Embed shim** (phase-1 add, `job-worker/worker/serve.py`): stdlib `ThreadingHTTPServer` on
  `:8080`, `POST /embed {text}` → `{embedding[384], dim}`, reusing the worker's lru-cached
  bge-small model (one instance, shared with the scraper thread). No query prefix — symmetric
  with `job_text()` so resume↔job vectors compare. Deployed + verified end-to-end on the box:
  `/health` ok, `/embed` returns 384-dim, and that vector run through pgvector cosine ranks
  backend/eng roles top. Started from `worker/main.py` on a daemon thread; port published in
  `docker-compose.yml`. **Same security note: restrict `:8080` to the app IP — it's unauth'd.**
- **App server fn** (`src/lib/jobs-functions.ts`, server-fns only — client-bundle rule): `matchJobs`
  is Pro-gated (dynamic `isProUser`), loads the resume ownership-scoped, `resumeToText` → POST to
  the shim → `matchByVector` (pgvector cosine, mirrors `match.py`) → optional OpenAI re-rank of the
  top 15. Degrades to `{configured:false}` when `EC2_EMBED_URL`/`EC2_JOBS_DATABASE_URL` unset (like
  billing); any shim/LLM failure falls back to plain vector order.
- **DB access** (`src/lib/jobs-db.ts`, server-only): `pg` Pool from `EC2_JOBS_DATABASE_URL`,
  dynamically imported so `pg` never enters the client bundle (verified: no `pg`/`jobs-db` in
  `dist/client`). Pure helpers (`vecLiteral`, `parseRerankOrder`, `applyRerank`) split into
  `jobs-rerank.ts` so the client route + offline check use them without touching `pg`.
- **UI** (`routes/_authenticated/dashboard.jobs.tsx` + `Jobs` nav link): resume picker + optional
  target-role box → ranked cards (score %, remote badge, "Apply ↗" opens the origin posting).
  Non-pro sees a locked card → billing. `.env.example`/`.env.local` gained `EC2_EMBED_URL` +
  `EC2_JOBS_DATABASE_URL`; `pg` added to vite `ssr.external`/`optimizeDeps.exclude` (like playwright).

Vector parity: JS embeds nothing — the app calls the worker's Python fastembed, so resume and job
vectors come from the *same* model+code. This is exactly the "tiny HTTP shim" `match.py` anticipated.

Verify: `npx tsx ./jobs.check.mjs` → **PASS** (vecLiteral format + rerank parse/apply); `npx tsc
--noEmit`, `npx biome check src`, `npm run build` all green. Not exercised locally against the live
DB (needs the EC2 Postgres password + a Pro user); the shim→pgvector path was proven on the box.

**Still open:** set `EC2_JOBS_DATABASE_URL` password in `.env.local` (from `~/job-worker/.env`), and
the security-group lockdown of `5432`+`8080` to the app IP.

## 2026-08-30 — Admin "Job ingestion" panel

Admin can now see whether the scraper is alive from `/admin/jobs`.

- **Server fn** `adminJobsStatus` (`src/lib/admin-functions.ts`, adminMiddleware, GET): returns
  `{configured:false}` when `EC2_JOBS_DATABASE_URL` unset; else dynamic-imports `jobsStatus(30)` from
  `jobs-db.ts` (keeps `pg` off the client), throws with reason on DB error.
- **Read helper** `jobsStatus()` (`src/lib/jobs-db.ts`): one round-trip of 3 parallel queries —
  totals (`count`, `active`, `embedded`, `max(fetched_at)`), per-`source` counts, and the 30 most
  recently fetched rows.
- **UI** `routes/_admin/admin.jobs.tsx` + overview link: 4 stat cards (Total/Active/Embedded/**Last
  fetch** relative time = freshness = "is scraping running"), "By source" list, "Recently fetched"
  table (title→origin link, company, source, fetched, state), Refresh button, amber "Not configured"
  card.

Verify: `npx tsr generate`, `npx tsc --noEmit`, `npx biome check src`, `npm run build` all green;
`pg`/`jobs-db` absent from `dist/client`. Not exercised against the live DB locally — `5432` and
`8080` both time out from this machine (SG allows only what it allows; safe posture). The panel
populates when the app runs from a security-group-allowed host, or those ports are opened to the app
IP.

## 2026-08-30 — Job Match UX: drag-upload + manual search

`/dashboard/jobs` reworked into two search modes so users don't need a saved resume.

- **Backend** (`src/lib/jobs-functions.ts`, `matchJobs`): validator gained `queryText` (≤4000).
  It wins over `resumeId` when present, so the handler embeds free text directly (manual
  role/skills/location, or the text of a dropped file). `resumeId` still resolves an owned resume
  when `queryText` empty; throws "Choose a resume or enter search terms" when both empty. Same
  shim→pgvector→optional-rerank path; the embedded text also feeds the rerank prompt.
- **UI** (`routes/_authenticated/dashboard.jobs.tsx`): segmented tabs "Use a resume" / "Search
  manually". Resume tab = a drag-drop dropzone (native DnD + hidden file input, reads text via
  `file.text()` — **.txt/.md only, ≤1 MB, zero deps**) with a filename chip, above an existing-resume
  `<select>` (disabled while a file is loaded). Manual tab = Role / Skills / Location inputs. Shared
  "Extra preferences" box. Results are richer cards: match %, remote badge, source hostname + posted
  age, "Apply ↗" to the origin.
  - ponytail: dropzone is text-only. PDF/DOCX resumes → build in-app ("Existing resume") or paste;
    upgrade path is a client-side `pdfjs` parse behind the same dropzone.

Verify: `npx biome check src`, `npx tsc --noEmit`, `npm run build` all green; `pg`/`jobs-db` still
absent from `dist/client`. Live matching still needs the app to run from a security-group-allowed
host (5432/8080 blocked from dev machine).

## 2026-08-30 — Portfolio hosting (`<name>.resmio.online`, Pro)

Cloudflare-Drop-style static hosting: Pro user drags portfolio files → live HTTPS site on the same
EC2 box as `job-worker/`. Mirrors the Job Match pattern (stdlib HTTP shim on EC2 + Pro-gated server
fn that degrades to `configured:false`). Full design in the approved plan.

- **EC2 stack `site-host/`** (new): `caddy:2` + a stdlib Python `publisher.py` shim sharing a `sites`
  volume. Caddy serves `/srv/sites/<label>/` for `*.resmio.online` with **on-demand TLS**, guarded
  by `ask → publisher:/check` (200 iff the site exists) so only real sites get certs. Publisher
  (`:8090`, Bearer `SITE_PUBLISH_TOKEN`): `POST /publish`, `DELETE /site/<p>`, open `GET /check`
  +`/health`. Guards: project regex + reserved names, extension allowlist, `..`/absolute reject,
  ≤25 files, ≤5 MB, `index.html` required, atomic temp-dir → `os.replace` swap. Smoke-tested locally:
  publish/check/delete + unauth 401 + traversal/no-index/reserved rejects all correct.
- **App**: `src/lib/sites-shared.ts` (pure, client-safe: `SUBDOMAIN_RE`, `RESERVED_SUBDOMAINS`,
  `ALLOWED_EXT`, `subdomainError`, `safeRelPath` — mirrors publisher.py). `src/lib/sites-functions.ts`
  (server-fn-only): `listSites`, `checkSubdomain`, `publishSite` (Pro-gated, validates+measures files,
  POSTs to shim, upserts row), `deleteSite` (ownership-scoped, best-effort remote delete). New `sites`
  table in `schema.ts` (unique `subdomain`, applied via `db:push`). Route
  `dashboard.sites.tsx`: multi-file drag-drop (arrayBuffer→chunked base64, uniform for text+binary),
  live subdomain availability, publish → live URL, "Your sites" list with Visit/Delete. `Sites` nav
  link added.
- **Env**: `SITE_PUBLISH_URL`, `SITE_PUBLISH_TOKEN`, `SITE_BASE_DOMAIN` in `.env.example`/`.env.local`.

**Security**: better-auth cookie is host-only (confirmed `src/lib/auth.ts` sets no `domain`) — MUST
stay that way so portfolio JS on sibling subdomains can't read the app session; app must live on a
reserved host. User HTML/JS served only from its own origin (static, no exec). `:8090` writes disk →
Bearer + **must be SG-restricted to the app IP**; `/check` is the only open path (boolean only).

**Ops still open** (need DNS/AWS console — confirm before infra changes): `*.resmio.online` A →
`3.83.35.75`; open `80`/`443`, restrict `8090` (and still-pending `5432`/`8080`) to the app IP;
`rsync site-host/` + `docker compose up -d --build`; set `SITE_PUBLISH_TOKEN` in both `.env` files.

Verify: `npx tsx ./sites.check.mjs` PASS; `npx tsr generate`, `npx tsc --noEmit`, `npx biome check
src`, `npm run build`, `npm run db:push` all green; no `SITE_PUBLISH_TOKEN`/`sites-functions`/`pg` in
`dist/client`.

### 2026-08-30 — site-host deployed to EC2 (blocked on domain registration)

Deployed the stack to `3.83.35.75`: `rsync site-host/` → `~/site-host` (excl. `__pycache__`), fresh
`openssl rand -hex 32` token into `~/site-host/.env` (chmod 600) and app `.env.local`
`SITE_PUBLISH_TOKEN`, `docker compose up -d --build`. Both containers Up:
`site-host-caddy-1` (`0.0.0.0:80`,`:443`) and `site-host-publisher-1` (`0.0.0.0:8090`).

On-box smoke test all correct: `/health` `{"ok":true}`; publish `smoketest` → `{"ok":true,files:1}`;
`/check` 200 for it, 404 for unknown; unauthenticated publish → 401; delete → `{"ok":true}` and
`/check` back to 404. Ports from dev machine: `80` open, `443` open, `8090` **closed** (already
SG-restricted — no security-group change was needed or made).

**BLOCKER — `resmio.online` is not registered/delegated.** The `.online` registry
(`dig @64.96.1.1 resmio.online A`) returns **NXDOMAIN** with only the TLD `SOA`; no NS delegation
exists, and `NS`/`SOA`/`A` are all empty via 1.1.1.1 and 8.8.8.8. A wildcard A record inside a
Hostinger DNS zone does nothing until the domain is registered and its nameservers are delegated to
Hostinger. Until then on-demand TLS cannot issue (Let's Encrypt must resolve the name), so no site is
reachable by hostname. Everything server-side is otherwise ready — this needs no code change.

Note for local dev: `.env.local` points at `http://3.83.35.75:8090`, which is SG-closed to the dev
machine. Either add the dev IP to the `8090` rule or use
`ssh -f -N -i job_runner.pem -L 8090:localhost:8090 ubuntu@3.83.35.75` and set
`SITE_PUBLISH_URL=http://localhost:8090` (tunnel verified working).

### 2026-08-30 — domain corrected to `resmio.in`; feature LIVE

Real domain is `resmio.in` (not `.online`). Wildcard `*.resmio.in` → `3.83.35.75` confirmed
resolving (Hostinger NS `*.dns-parking.com`). Replaced `resmio.online` → `resmio.in` everywhere:
`Caddyfile`, `sites-functions.ts` (`baseDomain` default), `dashboard.sites.tsx` (`BASE_DOMAIN`),
both `.env` files, README/comments. Redeployed: rsync + `docker compose up -d --build`; caddy needed
`--force-recreate` to re-read the bind-mounted Caddyfile (a `caddy reload` alone kept the stale
inode). EC2 `.env` `SITE_BASE_DOMAIN` set to `resmio.in`. `tsc --noEmit` clean.

End-to-end verified live: published `demo` → `curl -I https://demo.resmio.in` = **HTTP/2 200** with a
valid **Let's Encrypt** cert (`CN=demo.resmio.in`), body served, `x-content-type-options: nosniff`.
Unknown subdomain `nope-nothere.resmio.in` → TLS `internal error` (on-demand `ask` returned 404, no
cert issued — abuse protection working). Demo deleted afterwards. Ports: `80`/`443` open, `8090`
SG-closed to the world. Feature is fully operational.

### 2026-08-30 — folder upload (React/Vite build) + subdomain ownership hardening

- **Folder upload**: `dashboard.sites.tsx` now accepts a whole build directory, preserving nested
  paths. Drag-drop reads `DataTransferItem.webkitGetAsEntry()` recursively (`readEntry`/`pickedFromDrop`),
  and a new "Upload folder" button uses `<input webkitdirectory>` (`pickedFromInput` reads
  `webkitRelativePath`). New pure helper `rootPrefix(paths)` in `sites-shared.ts` rebases a
  `build/`/`dist/` wrapper so its `index.html` becomes the site root; unit-tested in `sites.check.mjs`.
  Verified live: nested `index.html` + `assets/app.js` + `assets/style.css` all served 200 over HTTPS
  at `build-demo.resmio.in`.
- **Limits raised** for real builds: `MAX_SITE_FILES` 25→200, `MAX_SITE_BYTES` 5→20 MB in both
  `sites-shared.ts` and `publisher.py` (kept in sync); publisher payload cap now `MAX_TOTAL*2` for
  base64 headroom. Publisher redeployed (`docker compose up -d --build publisher`), limits confirmed
  in-container.
- **Ownership**: already enforced (a subdomain owned by another user can't be published or checked
  as available; `subdomain` has a unique index). Added a graceful catch on the insert race →
  "That subdomain was just taken. Pick another." Live availability check on type was already present
  (350 ms debounced `checkSubdomain`).
- Verify: `sites.check` PASS, `tsc --noEmit` clean, `biome check` clean on all touched files.

### 2026-08-31 — Social login (Google + GitHub)

- `src/lib/auth.ts`: `socialProviders()` registers google/github only when their
  `*_CLIENT_ID`/`*_CLIENT_SECRET` env pair is set (graceful when unset).
- `src/routes/login.tsx`: shared `SocialButtons` component (divider + two OAuth
  buttons with brand icons) via `authClient.signIn.social({ provider, callbackURL })`;
  reused in `signup.tsx`.
- Messages: `auth_or`, `auth_continue_google`, `auth_continue_github` (en/de); paraglide recompiled.
- Env: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` added to `.env.example`/`.env.local`.
  OAuth callback URLs: `${BETTER_AUTH_URL}/api/auth/callback/{google,github}`.
- Verify: `tsc --noEmit` clean, `biome check src` clean.
