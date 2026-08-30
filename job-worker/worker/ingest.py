"""One ingestion pass: fetch -> dedup -> embed -> upsert -> sweep stale."""

from __future__ import annotations

import os
from pathlib import Path

import yaml

from . import db
from .embed import embed_texts, job_text
from .fetchers import fetch_all
from .normalize import Job, dedup

COMPANIES = Path(__file__).resolve().parent.parent / "companies.yaml"

# Embed+upsert in chunks so peak RAM stays flat — a small EC2 box OOM-kills if we
# embed thousands of descriptions at once. 64 keeps well under ~1GB.
CHUNK = int(os.getenv("EMBED_CHUNK", "64"))


def load_companies() -> dict[str, list[str]]:
    with open(COMPANIES) as f:
        return yaml.safe_load(f) or {}


def _chunks(xs: list[Job], n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def run_once() -> dict[str, int]:
    companies = load_companies()
    jobs = dedup(fetch_all(companies))
    if not jobs:
        print("[ingest] no jobs fetched; skipping db write")
        return {"fetched": 0, "upserted": 0, "deactivated": 0}

    conn = db.connect()
    upserted = 0
    try:
        # Stream: embed one chunk, write it, drop it. Never hold all vectors at once.
        for chunk in _chunks(jobs, CHUNK):
            texts = [
                job_text(j["title"], j["company"], j["location"], j["description"])
                for j in chunk
            ]
            vecs = embed_texts(texts)
            embeddings = {j["id"]: v for j, v in zip(chunk, vecs)}
            upserted += db.upsert_jobs(conn, chunk, embeddings)
        deactivated = db.deactivate_missing(conn, [j["id"] for j in jobs])
    finally:
        conn.close()

    stats = {"fetched": len(jobs), "upserted": upserted, "deactivated": deactivated}
    print(f"[ingest] {stats}")
    return stats


if __name__ == "__main__":
    run_once()
