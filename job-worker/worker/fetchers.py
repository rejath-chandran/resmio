"""Tier-1 fetchers: public ATS JSON endpoints. No HTML scraping, no anti-bot.

ponytail: only Greenhouse + Lever. Add Ashby/Workable/SmartRecruiters (all have
public JSON) or Scrapling-based tier-2 HTML boards when volume needs it.
"""

from __future__ import annotations

import httpx

from .normalize import Job, normalize_greenhouse, normalize_lever

_TIMEOUT = httpx.Timeout(20.0)
_UA = "resmio-jobbot/1.0 (+https://resmio.app; contact ops@resmio.app)"


def _get(client: httpx.Client, url: str) -> dict:
    r = client.get(url, headers={"user-agent": _UA})
    r.raise_for_status()
    return r.json()


def fetch_greenhouse(client: httpx.Client, slug: str) -> list[Job]:
    # content=true returns the full job description in one call.
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    data = _get(client, url)
    return [normalize_greenhouse(slug, j) for j in data.get("jobs", [])]


def fetch_lever(client: httpx.Client, slug: str) -> list[Job]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    data = _get(client, url)
    return [normalize_lever(slug, j) for j in data]


def fetch_all(companies: dict[str, list[str]]) -> list[Job]:
    """companies = {'greenhouse': [slugs], 'lever': [slugs]}. Skips failing slugs."""
    fetchers = {"greenhouse": fetch_greenhouse, "lever": fetch_lever}
    out: list[Job] = []
    with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
        for source, slugs in companies.items():
            fn = fetchers.get(source)
            if not fn:
                print(f"[warn] unknown source '{source}', skipping")
                continue
            for slug in slugs or []:
                try:
                    jobs = fn(client, slug)
                    out.extend(jobs)
                    print(f"[ok] {source}:{slug} -> {len(jobs)} jobs")
                except Exception as e:  # one bad slug never kills the run
                    print(f"[err] {source}:{slug} -> {e}")
    return out
