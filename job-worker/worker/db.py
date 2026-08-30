"""Postgres access. Owns the jobs store; the app reads it read-only."""

from __future__ import annotations

import os

import psycopg

from .normalize import Job


def connect() -> psycopg.Connection:
    url = os.environ["JOBS_DATABASE_URL"]
    return psycopg.connect(url, autocommit=True)


def _vec(v: list[float] | None) -> str | None:
    # pgvector text input format: '[0.1,0.2,...]'
    return None if v is None else "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def upsert_jobs(
    conn: psycopg.Connection,
    jobs: list[Job],
    embeddings: dict[str, list[float]] | None = None,
) -> int:
    """Insert/refresh jobs. Re-activates and re-stamps fetched_at on conflict."""
    embeddings = embeddings or {}
    rows = [
        (
            j["id"], j["source"], j["external_id"], j["title"], j["company"],
            j["location"], j["remote"], j["description"], j["url"],
            j["posted_at"], _vec(embeddings.get(j["id"])),
        )
        for j in jobs
    ]
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO jobs (id, source, external_id, title, company, location,
                              remote, description, url, posted_at, embedding, active)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, true)
            ON CONFLICT (source, external_id) DO UPDATE SET
              title=EXCLUDED.title, location=EXCLUDED.location,
              remote=EXCLUDED.remote, description=EXCLUDED.description,
              url=EXCLUDED.url, posted_at=EXCLUDED.posted_at,
              embedding=COALESCE(EXCLUDED.embedding, jobs.embedding),
              fetched_at=now(), active=true
            """,
            rows,
        )
    return len(rows)


def deactivate_missing(conn: psycopg.Connection, seen_ids: list[str]) -> int:
    """Mark jobs not seen in this run inactive. Empty run = no-op (safety)."""
    if not seen_ids:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET active=false WHERE active=true AND id <> ALL(%s)",
            (seen_ids,),
        )
        return cur.rowcount
