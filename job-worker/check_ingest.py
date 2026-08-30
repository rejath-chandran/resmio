"""Offline self-check: normalize + dedup + id stability. No network, no db, no deps.

Run:  python check_ingest.py   (only needs worker/normalize.py, stdlib only)
"""

from __future__ import annotations

from worker.normalize import (
    dedup,
    make_id,
    normalize_greenhouse,
    normalize_lever,
)

GH = {
    "id": 123,
    "title": "Senior <b>Backend</b> Engineer",
    "location": {"name": "Remote - US"},
    "content": "<p>Build &amp; scale APIs.</p>",
    "absolute_url": "https://boards.greenhouse.io/acme/jobs/123",
    "updated_at": "2026-08-01T00:00:00Z",
}
LV = {
    "id": "abc-def",
    "text": "Data Scientist",
    "categories": {"location": "Berlin", "workplaceType": "onsite"},
    "descriptionPlain": "Do ML things.",
    "hostedUrl": "https://jobs.lever.co/acme/abc-def",
    "createdAt": 1754006400000,
}


def main() -> None:
    g = normalize_greenhouse("acme", GH)
    assert g["title"] == "Senior Backend Engineer", g["title"]  # tags stripped
    assert g["description"] == "Build & scale APIs.", g["description"]  # entities decoded
    assert g["remote"] is True, "‘Remote - US’ should flag remote"
    assert g["url"].endswith("/123")
    assert g["posted_at"] == "2026-08-01T00:00:00Z"

    l = normalize_lever("acme", LV)
    assert l["title"] == "Data Scientist"
    assert l["remote"] is False
    assert l["posted_at"] == "2025-08-01T00:00:00+00:00", l["posted_at"]  # epoch ms -> ISO

    # id is stable and source-scoped
    assert g["id"] == make_id("greenhouse", "123")
    assert g["id"] != l["id"]

    # dedup: same posting twice collapses to one
    assert len(dedup([g, g, l])) == 2

    print(f"PASS check_ingest — greenhouse+lever normalized, dedup 3->2, remote flags ok")


if __name__ == "__main__":
    main()
