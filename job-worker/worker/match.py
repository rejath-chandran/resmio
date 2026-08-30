"""Cosine match: resume text -> top-N active jobs. Reference query for the app.

The TanStack app runs the equivalent SQL over the same DB (it embeds the resume
with its own model call, or reuses this via a tiny HTTP shim later).
"""

from __future__ import annotations

from . import db
from .embed import embed_texts, DIM


def match(resume_text: str, limit: int = 50) -> list[dict]:
    vec = embed_texts([resume_text])[0]
    assert len(vec) == DIM
    vec_str = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, company, location, remote, url, posted_at,
                       1 - (embedding <=> %s::vector) AS score
                FROM jobs
                WHERE active = true AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (vec_str, vec_str, limit),
            )
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        conn.close()


if __name__ == "__main__":
    import sys

    q = " ".join(sys.argv[1:]) or "python backend engineer with postgres"
    for j in match(q, limit=10):
        print(f"{j['score']:.3f}  {j['title']} @ {j['company']}  {j['url']}")
