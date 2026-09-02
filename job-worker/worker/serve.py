"""HTTP shim for the TanStack app (now a Cloudflare Worker, which can't hold a
Postgres connection). Stdlib http only (no extra dep). Endpoints:

  POST /embed              (open)    {text}          -> {embedding, dim}
  POST /match              (Bearer)  {vec, limit}    -> [JobRow]
  POST /status             (Bearer)  {recentLimit?}  -> JobsStatus
  GET  /health             (open)

/embed reuses the lru-cached bge-small-en-v1.5 model from embed.py (shared with the
scraper thread; vectors stay comparable — NO query prefix, symmetric with job_text).
/match and /status read Postgres, so they require JOBS_SHIM_TOKEN. Publish the port
ONLY to the app's egress IP in the EC2 security group (same rule as Postgres 5432).
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import db
from .embed import DIM, embed_texts

MAX_BODY = 64 * 1024  # a resume blob or a 384-float vector; job_text caps at 4000 chars
TOKEN = os.getenv("JOBS_SHIM_TOKEN", "")


def _vec_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def _match(vec: list[float], limit: int) -> list[dict]:
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            v = _vec_literal(vec)
            cur.execute(
                """
                SELECT id, title, company, location, remote, url, posted_at,
                       1 - (embedding <=> %s::vector) AS score
                FROM jobs
                WHERE active = true AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (v, v, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        posted = r[6]
        out.append(
            {
                "id": r[0], "title": r[1], "company": r[2], "location": r[3],
                "remote": bool(r[4]), "url": r[5],
                "postedAt": int(posted.timestamp() * 1000) if posted else None,
                "score": float(r[7]),
            }
        )
    return out


def _status(recent_limit: int) -> dict:
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT count(*), count(*) FILTER (WHERE active),
                          count(*) FILTER (WHERE embedding IS NOT NULL), max(fetched_at)
                   FROM jobs"""
            )
            total, active, embedded, last = cur.fetchone()
            cur.execute(
                """SELECT source, count(*), count(*) FILTER (WHERE active)
                   FROM jobs GROUP BY source ORDER BY count(*) DESC"""
            )
            by_source = cur.fetchall()
            cur.execute(
                """SELECT title, company, source, fetched_at, active, url
                   FROM jobs ORDER BY fetched_at DESC NULLS LAST LIMIT %s""",
                (recent_limit,),
            )
            recent = cur.fetchall()
    finally:
        conn.close()
    return {
        "total": int(total), "active": int(active), "embedded": int(embedded),
        "lastFetchedAt": int(last.timestamp() * 1000) if last else None,
        "bySource": [
            {"source": s, "n": int(n), "active": int(a)} for s, n, a in by_source
        ],
        "recent": [
            {
                "title": t, "company": c, "source": s,
                "fetchedAt": int(f.timestamp() * 1000) if f else None,
                "active": bool(a), "url": u,
            }
            for t, c, s, f, a, u in recent
        ],
    }


class _Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self) -> bool:
        return bool(TOKEN) and self.headers.get("authorization") == f"Bearer {TOKEN}"

    def _body(self) -> dict | None:
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._send(400, {"error": "bad content-length"})
            return None
        try:
            return json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "invalid JSON"})
            return None

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, {"ok": True, "dim": DIM})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/embed":
            payload = self._body()
            if payload is None:
                return
            text = payload.get("text")
            if not isinstance(text, str) or not text.strip():
                self._send(400, {"error": "expected {text: non-empty string}"})
                return
            vec = embed_texts([text[:4000]])[0]
            self._send(200, {"embedding": vec, "dim": DIM})
            return

        if self.path in ("/match", "/status"):
            if not self._authed():
                self._send(401, {"error": "unauthorized"})
                return
            payload = self._body()
            if payload is None:
                return
            try:
                if self.path == "/match":
                    vec = payload["vec"]
                    if not isinstance(vec, list) or len(vec) != DIM:
                        raise ValueError("vec")
                    limit = min(max(int(payload.get("limit", 25)), 1), 50)
                    self._send(200, _match(vec, limit))
                else:
                    recent = min(max(int(payload.get("recentLimit", 30)), 1), 100)
                    self._send(200, _status(recent))
            except (KeyError, ValueError, TypeError):
                self._send(400, {"error": "bad request"})
            return

        self._send(404, {"error": "not found"})

    def log_message(self, *_args) -> None:  # quiet; scraper logs are enough
        pass


def serve() -> None:
    port = int(os.getenv("EMBED_PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), _Handler).serve_forever()
