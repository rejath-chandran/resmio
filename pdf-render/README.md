# pdf-render

Playwright/Chromium PDF service for Resmio. The app runs on Cloudflare Workers,
which can't launch a browser, so `/api/pdf` (session-gated + validated) forwards
`{content, styles}` here and streams back the PDF.

## Endpoints
- `POST /render` — Bearer `PDF_RENDER_TOKEN`; body `{content, styles}` (strings) → `application/pdf` (A4).
- `GET /health` — open.

## Run

```sh
cp .env.example .env      # set PDF_RENDER_TOKEN (openssl rand -hex 32)
docker compose up -d --build
curl -s localhost:8095/health          # {"ok":true}
```

## Wire to the Worker
Set on the Worker so it can reach this box:
```sh
wrangler secret put PDF_RENDER_URL     # http://<ec2-ip>:8095
wrangler secret put PDF_RENDER_TOKEN   # same value as .env here
```

## Security
No auth = no render. Restrict the port to the app's egress IP in the EC2 security
group. Rendering blocks all network requests (`page.route` abort) — resume markup
is self-contained, so nothing external is fetched.
