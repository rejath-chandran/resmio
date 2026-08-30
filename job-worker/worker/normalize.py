"""Raw ATS payloads -> normalized Job dicts. Pure, no network/db (so it's testable)."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any, TypedDict


class Job(TypedDict):
    id: str
    source: str
    external_id: str
    title: str
    company: str
    location: str
    remote: bool
    description: str
    url: str
    posted_at: str | None  # ISO8601 or None


_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _text(html: str | None) -> str:
    """Strip tags/entities to plain text for embedding + display."""
    if not html:
        return ""
    s = _TAG.sub(" ", html)
    s = (
        s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .replace("&quot;", '"')
    )
    return _WS.sub(" ", s).strip()


def make_id(source: str, external_id: str) -> str:
    return hashlib.sha1(f"{source}:{external_id}".encode()).hexdigest()


def _iso(ts: str | int | None) -> str | None:
    """Greenhouse gives ISO strings; Lever gives epoch millis."""
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
    return str(ts)


def normalize_greenhouse(company: str, raw: dict[str, Any]) -> Job:
    ext = str(raw["id"])
    loc = (raw.get("location") or {}).get("name", "") or ""
    return Job(
        id=make_id("greenhouse", ext),
        source="greenhouse",
        external_id=ext,
        title=_text(raw.get("title")),
        company=company,
        location=loc,
        remote="remote" in loc.lower(),
        description=_text(raw.get("content")),
        url=raw.get("absolute_url", ""),
        posted_at=_iso(raw.get("updated_at") or raw.get("created_at")),
    )


def normalize_lever(company: str, raw: dict[str, Any]) -> Job:
    ext = str(raw["id"])
    cats = raw.get("categories") or {}
    loc = cats.get("location", "") or ""
    wt = (cats.get("workplaceType") or "").lower()
    return Job(
        id=make_id("lever", ext),
        source="lever",
        external_id=ext,
        title=_text(raw.get("text")),
        company=company,
        location=loc,
        remote=wt == "remote" or "remote" in loc.lower(),
        description=_text(raw.get("descriptionPlain") or raw.get("description")),
        url=raw.get("hostedUrl", ""),
        posted_at=_iso(raw.get("createdAt")),
    )


def dedup(jobs: list[Job]) -> list[Job]:
    """Last wins on duplicate id (same posting from overlapping sources)."""
    by_id: dict[str, Job] = {}
    for j in jobs:
        by_id[j["id"]] = j
    return list(by_id.values())
