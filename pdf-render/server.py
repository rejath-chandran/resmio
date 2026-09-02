"""PDF render service for Resmio. Chromium can't run in a Cloudflare Worker, so
/api/pdf forwards resume markup here (EC2, Playwright). Stdlib http only.

  POST /render   (Bearer PDF_RENDER_TOKEN)  {content, styles} -> application/pdf
  GET  /health   (open)

Publish the port ONLY to the app's egress IP in the EC2 security group.

ponytail: launches Chromium per request (Playwright sync objects are thread-bound,
and PDF export is infrequent). Add a persistent browser + a serialized render queue
when volume makes the ~300ms launch cost hurt.
"""

from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

MAX_BODY = 2_000_000  # ~2MB of markup+CSS is plenty for one A4 sheet
TOKEN = os.getenv("PDF_RENDER_TOKEN", "")
MARGIN = {"top": "12mm", "bottom": "12mm", "left": "12mm", "right": "12mm"}

_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>{styles}</style>
</head><body>{content}</body></html>"""


def _render(content: str, styles: str) -> bytes:
    html = _HTML.format(styles=styles, content=content)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            page = browser.new_page()
            # No network: resume markup is self-contained, block external fetches.
            page.route("**/*", lambda route: route.abort())
            page.set_content(html, wait_until="load")
            return page.pdf(
                format="A4", print_background=True, margin=MARGIN
            )
        finally:
            browser.close()


class _Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code: int, msg: str) -> None:
        self._send(code, msg.encode(), "text/plain")

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, b'{"ok":true}', "application/json")
        else:
            self._err(404, "not found")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/render":
            self._err(404, "not found")
            return
        if not TOKEN or self.headers.get("authorization") != f"Bearer {TOKEN}":
            self._err(401, "unauthorized")
            return
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._err(400, "bad content-length")
            return
        import json

        try:
            payload = json.loads(self.rfile.read(length))
            content, styles = payload["content"], payload["styles"]
            if not isinstance(content, str) or not isinstance(styles, str):
                raise ValueError
        except (ValueError, KeyError, json.JSONDecodeError):
            self._err(400, "expected {content: string, styles: string}")
            return
        try:
            self._send(200, _render(content, styles), "application/pdf")
        except Exception:  # noqa: BLE001 — render failure -> 502 to the Worker
            self._err(502, "render failed")

    def log_message(self, *_args) -> None:  # quiet
        pass


def main() -> None:
    port = int(os.getenv("PDF_RENDER_PORT", "8095"))
    ThreadingHTTPServer(("0.0.0.0", port), _Handler).serve_forever()


if __name__ == "__main__":
    main()
