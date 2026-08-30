"""Portfolio publisher shim — the ONLY writer of /srv/sites, shared (read-only) with
Caddy which serves each <name>.resmio.in from /srv/sites/<name>/.

Stdlib http only (no deps), mirrors job-worker/worker/serve.py. Endpoints:
  POST   /publish            (Bearer) {project, title?, files:[{path, data(base64)}]}
  DELETE /site/<project>     (Bearer)
  GET    /check?domain=x     (open)   -> 200 iff /srv/sites/x/index.html exists  (Caddy on_demand ask)
  GET    /health             (open)

Writes disk, so /publish + DELETE require SITE_PUBLISH_TOKEN. Restrict :8090 to the
app IP in the EC2 security group (same posture as Postgres 5432 / embed 8080).
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

SITES_DIR = os.getenv("SITES_DIR", "/srv/sites")
TOKEN = os.getenv("SITE_PUBLISH_TOKEN", "")
PORT = int(os.getenv("PUBLISH_PORT", "8090"))

MAX_TOTAL = 20 * 1024 * 1024  # 20 MB per site (room for a real build + source maps)
MAX_FILES = 200
PROJECT_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$")  # 3-63, no lead/trail hyphen
RESERVED = {
    "app", "www", "api", "admin", "mail", "cdn", "static", "assets", "ftp",
    "ns1", "ns2", "smtp", "imap", "pop", "webmail", "dashboard", "billing",
    "status", "docs", "blog", "help", "support", "resmio",
}
ALLOWED_EXT = {
    ".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".png", ".jpg",
    ".jpeg", ".gif", ".webp", ".ico", ".txt", ".woff", ".woff2", ".map",
}
# APPEND


def valid_project(name: str) -> bool:
    return bool(PROJECT_RE.match(name)) and name not in RESERVED


def safe_rel_path(path: str) -> str | None:
    """Normalise a client file path to a safe relative path under the site dir, or None."""
    p = path.strip().lstrip("/").replace("\\", "/")
    if not p or p.startswith(".") or ".." in p.split("/"):
        return None
    if os.path.splitext(p)[1].lower() not in ALLOWED_EXT:
        return None
    return p


class _Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self) -> bool:
        expected = f"Bearer {TOKEN}"
        return bool(TOKEN) and self.headers.get("authorization") == expected

    def do_GET(self) -> None:  # noqa: N802
        u = urlparse(self.path)
        if u.path == "/health":
            self._send(200, {"ok": True})
            return
        if u.path == "/check":
            # Caddy on_demand_tls ask: 200 iff this domain maps to a real site.
            domain = (parse_qs(u.query).get("domain", [""])[0]).lower()
            label = domain.split(".")[0] if domain else ""
            ok = bool(label) and os.path.isfile(
                os.path.join(SITES_DIR, label, "index.html")
            )
            self._send(200 if ok else 404, {"ok": ok})
            return
        self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        if not self._authed():
            self._send(401, {"error": "unauthorized"})
            return
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != "site" or not valid_project(parts[1]):
            self._send(400, {"error": "bad path"})
            return
        shutil.rmtree(os.path.join(SITES_DIR, parts[1]), ignore_errors=True)
        self._send(200, {"ok": True})

    def do_POST(self) -> None:  # noqa: N802
        if not self._authed():
            self._send(401, {"error": "unauthorized"})
            return
        if urlparse(self.path).path != "/publish":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_TOTAL * 2:  # base64 (~1.37x) + JSON headroom
            self._send(413, {"error": "payload too large"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
            project = str(payload["project"]).lower()
            files = payload["files"]
            if not isinstance(files, list) or not files:
                raise ValueError("no files")
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self._send(400, {"error": "expected {project, files:[{path,data}]}"})
            return
        if not valid_project(project):
            self._send(400, {"error": "invalid or reserved project name"})
            return
        if len(files) > MAX_FILES:
            self._send(400, {"error": f"too many files (max {MAX_FILES})"})
            return

        # Decode + validate everything before touching disk.
        decoded: list[tuple[str, bytes]] = []
        total = 0
        for f in files:
            rel = safe_rel_path(str(f.get("path", "")))
            if rel is None:
                self._send(400, {"error": f"bad file path: {f.get('path')!r}"})
                return
            try:
                blob = base64.b64decode(str(f.get("data", "")), validate=True)
            except (ValueError, TypeError):
                self._send(400, {"error": f"bad base64 for {rel}"})
                return
            total += len(blob)
            if total > MAX_TOTAL:
                self._send(413, {"error": "site exceeds 20 MB"})
                return
            decoded.append((rel, blob))

        if not any(rel == "index.html" for rel, _ in decoded):
            self._send(400, {"error": "index.html is required"})
            return

        # Atomic swap: write to <dir>.tmp then replace the live dir.
        dest = os.path.join(SITES_DIR, project)
        tmp = dest + ".tmp"
        shutil.rmtree(tmp, ignore_errors=True)
        for rel, blob in decoded:
            fp = os.path.join(tmp, rel)
            os.makedirs(os.path.dirname(fp) or tmp, exist_ok=True)
            with open(fp, "wb") as fh:
                fh.write(blob)
        shutil.rmtree(dest, ignore_errors=True)
        os.replace(tmp, dest)
        self._send(
            200,
            {"ok": True, "project": project, "files": len(decoded), "bytes": total},
        )

    def log_message(self, *_args) -> None:  # quiet
        pass


def main() -> None:
    if not TOKEN:
        raise SystemExit("SITE_PUBLISH_TOKEN is required")
    os.makedirs(SITES_DIR, exist_ok=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), _Handler).serve_forever()


if __name__ == "__main__":
    main()
