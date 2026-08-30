# job-worker

24h job ingestion for Resmio's Pro "AI Job Match" feature. Scrapes public ATS
feeds → normalizes → embeds (local, $0) → Postgres+pgvector. The TanStack app
reads this DB read-only and ranks jobs against a user's resume by cosine
similarity. **Index, not a mirror** — every job links out to the origin site to apply.

## Run on EC2

```bash
cp .env.example .env && edit .env      # set POSTGRES_PASSWORD
docker compose up -d                   # db + worker (worker runs once, then every 6h)
docker compose logs -f worker          # watch ingestion
```

App connects with:  `EC2_JOBS_DATABASE_URL=postgresql://jobs:<pw>@<ec2-ip>:5432/jobs`
(Open the DB port only to the app's IP via the EC2 security group — see Security.)

The worker also serves an **embed shim** on `:8080` so the app embeds resumes with the
same model (bge-small-en-v1.5, 384-dim) → vectors are cosine-comparable:

```
POST /embed  {"text": "..."}  ->  {"embedding": [384 floats], "dim": 384}
GET  /health                  ->  {"ok": true, "dim": 384}
```

App connects with:  `EC2_EMBED_URL=http://<ec2-ip>:8080`. Unauthenticated —
restrict `:8080` to the app's IP too (same rule as Postgres).

## Local dev

```bash
python check_ingest.py                 # offline self-check (stdlib only, no deps)
pip install -r requirements.txt
python -m worker.ingest                # one real pass (needs JOBS_DATABASE_URL)
python -m worker.match "python backend engineer"   # test ranking
```

## Add companies

Edit `companies.yaml` — slugs only, no code. Slug = the id in the careers URL
(`boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`).

## Layout

| File | Role |
|---|---|
| `worker/fetchers.py` | Tier-1 public JSON (Greenhouse, Lever) |
| `worker/normalize.py` | raw → `Job`, tag-strip, stable id, dedup (pure) |
| `worker/embed.py` | fastembed bge-small-en-v1.5 (384-dim) |
| `worker/db.py` | upsert + stale-sweep (Postgres) |
| `worker/ingest.py` | one pass: fetch→dedup→embed→upsert→sweep |
| `worker/match.py` | cosine top-N (reference query for the app) |
| `worker/serve.py` | embed shim (`POST /embed`) — app embeds resumes here |
| `worker/main.py` | boot pass + APScheduler loop + embed shim thread |

## Security

- Never expose Postgres to `0.0.0.0`. Restrict `5432` **and the embed shim `8080`** to
  the app server's IP in the EC2 security group. The embed shim is unauthenticated.
- Respect each board's ToS and `robots.txt`; keep the descriptive User-Agent in
  `fetchers.py`. Tier-1 endpoints are public/intended for this.
- Store only metadata + a link out; don't republish full descriptions elsewhere.

## Cost

EC2 `t4g.small` (~$12/mo) or free-tier `t4g.micro`. Embeddings local = $0.
Postgres self-hosted = $0 beyond the box. No third-party job API fees.

ponytail: Tier-1 only (Greenhouse+Lever). Add Ashby/Workable/SmartRecruiters
(public JSON) or Scrapling tier-2 HTML boards when volume needs it.
