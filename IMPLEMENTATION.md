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
npm run build && npx tsc --noEmit && npx biome check src
```

Env in `.env.local` (template: `.env.example`) — `DATABASE_URL` (default `dev.db`),
`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (**set a real secret before deploying**),
`OPENAI_API_KEY`, optional `OPENAI_BASE_URL` / `OPENAI_MODEL`.

Schema changes: `npm run db:push`. Message changes: recompile paraglide with
`npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide`.
New/moved routes: `npx tsr generate`.

## Stack

TanStack Start 1.170 (Vite 8) · SQLite via drizzle + better-sqlite3 · better-auth 1.5
· Tailwind v4 · zustand · framer-motion · paraglide v2 (en/de) · Biome · Playwright

Decisions made with the user: AI provider is **OpenAI-compatible over `fetch`** (no SDK),
DB is a **local file**, **no billing** yet.

## Current state

Feature-complete and green: `npm run build` ✓, `tsc` ✓, `biome` ✓,
e2e-smoke **18/18**, pdf-export check passing (filled 35424b vs empty 874b).

| Area | Where | Notes |
|---|---|---|
| Landing | `src/routes/index.tsx`, `src/components/landing/` | hero, features, how-it-works, pricing, testimonials, footer; framer-motion `whileInView`; SEO via `head()` |
| Auth | `src/lib/auth.ts`, `routes/login.tsx`, `signup.tsx`, `routes/api/auth/$.ts` | better-auth email/password, drizzle adapter, `tanstackStartCookies()` |
| Route guard | `src/routes/_authenticated.tsx` | `beforeLoad` → `/login?redirect=`; children live in `_authenticated/` |
| Dashboard | `_authenticated/dashboard.index.tsx` | card grid, per-template mini previews, create/delete |
| Builder | `_authenticated/dashboard.$resumeId.tsx`, `components/builder/editor.tsx` | basics/experience/education/skills, AI improve buttons |
| Autosave | `src/lib/builder-store.ts` | zustand + 800ms debounce; route injects the persister via `setPersister` |
| Preview | `components/resume-preview/templates.tsx` | modern / classic / minimal, pure components |
| PDF export | `src/lib/pdf-export.ts` + `src/routes/api/pdf.ts` | client clones `#resume-sheet` + page CSS → server renders with headless Chromium |
| AI | `src/lib/ai-functions.ts` | OpenAI-compatible `chat/completions`; heuristic local fallback when no key |
| i18n | `messages/{en,de}.json`, `src/start.ts`, `src/router.tsx` | paraglide `url` strategy; `/de/…` works |

### Deliberate simplifications (`ponytail:` comments in code)

- **One Chromium launch per PDF request** (`routes/api/pdf.ts`) — pool or move to a
  worker when exports become concurrent.
- **`issuer` / `provider_account_id` columns hand-added** to the account table
  (`src/db/schema.ts:55`) — drop when regenerating schema via the better-auth CLI.
- **Only session fetch is exposed** as a server fn (`src/lib/auth-functions.ts`) —
  user mutations stay internal to better-auth until a settings page exists.
- **Single-page A4 export** — no pagination markers; add when resumes overflow one page.
- **No billing** — pricing cards on the landing page are static.

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
