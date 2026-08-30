"""Tiny embed HTTP shim so the TanStack app can embed a resume with the SAME
model the worker used for jobs (bge-small-en-v1.5, 384-dim) — vectors are then
directly comparable for cosine match. Stdlib http only (no extra dep); reuses the
lru-cached model from embed.py, so this shares the one model instance with the
scraper thread. NO query prefix — kept symmetric with job_text() (see match.py).

Bind is container-internal; publish the port ONLY to the app IP via the EC2
security group (same rule as Postgres 5432). This endpoint is unauthenticated.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .embed import DIM, embed_texts

MAX_BODY = 16 * 1024  # a resume blob; job_text caps at 4000 chars anyway


class _Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, {"ok": True, "dim": DIM})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/embed":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._send(400, {"error": "bad content-length"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
            text = payload["text"]
            if not isinstance(text, str) or not text.strip():
                raise ValueError("empty text")
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self._send(400, {"error": "expected JSON {text: non-empty string}"})
            return
        vec = embed_texts([text[:4000]])[0]  # same 4000 cap as job_text
        self._send(200, {"embedding": vec, "dim": DIM})

    def log_message(self, *_args) -> None:  # quiet; scraper logs are enough
        pass


def serve() -> None:
    port = int(os.getenv("EMBED_PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), _Handler).serve_forever()
