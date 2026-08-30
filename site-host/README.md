# site-host — portfolio hosting (`<name>.resmio.in`)

Caddy + a tiny Python publisher shim on the same EC2 box as `job-worker/`. Users publish a static
portfolio from the app; Caddy serves it over HTTPS at `https://<name>.resmio.in`.

## Pieces
- **Caddy** (`Caddyfile`) — auto-HTTPS via **on-demand TLS**, serving `/srv/sites/<label>/` for each
  `<label>.resmio.in`. Before issuing a cert it asks `publisher:/check` so only real sites get
  one (blocks cert-issuance abuse).
- **publisher** (`publisher.py`) — stdlib `ThreadingHTTPServer`, the only writer of `/srv/sites`:
  - `POST /publish` (Bearer `SITE_PUBLISH_TOKEN`) `{project, title?, files:[{path, data(base64)}]}`
  - `DELETE /site/<project>` (Bearer)
  - `GET /check?domain=<name>.resmio.in` (open) → 200 iff the site exists (Caddy `ask`)
  - `GET /health` (open)
  Guards: project regex `^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$` + reserved names, extension
  allowlist, `..`/absolute rejection, ≤ 25 files, ≤ 5 MB, `index.html` required, atomic dir swap.

## Prerequisites (DNS + security group)
1. `*.resmio.in` **A** record → `3.83.35.75`. (Keep the app on a reserved host — e.g. `app` —
   and never scope the app's auth cookie to `.resmio.in`.)
2. Security group: open **80** + **443** to the world (Caddy needs them for ACME + serving).
   Keep **8090** restricted to the app server IP — it writes disk (Bearer-auth'd, but don't expose).

## Deploy (mirrors job-worker)
```
rsync -av --exclude __pycache__ site-host/ ubuntu@3.83.35.75:~/site-host
ssh -i job_runner.pem ubuntu@3.83.35.75
cd ~/site-host
printf 'SITE_PUBLISH_TOKEN=%s\nPUBLISH_PORT=8090\n' "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose up -d --build
```
Put that same `SITE_PUBLISH_TOKEN` into the app's `.env.local` alongside
`SITE_PUBLISH_URL=http://3.83.35.75:8090` and `SITE_BASE_DOMAIN=resmio.in`.

## Smoke test (on the box)
```
T=$(grep -oP '(?<=SITE_PUBLISH_TOKEN=).*' .env)
curl -s localhost:8090/health
curl -s -XPOST localhost:8090/publish -H "authorization: Bearer $T" \
  -d '{"project":"demo","files":[{"path":"index.html","data":"'"$(printf '<h1>hi</h1>' | base64)"'"}]}'
curl -s "localhost:8090/check?domain=demo.resmio.in"   # {"ok":true}
```
Then `curl -I https://demo.resmio.in` from anywhere once DNS + 443 are live.
