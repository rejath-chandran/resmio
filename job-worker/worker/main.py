"""Entrypoint: run one pass now, then every SCRAPE_INTERVAL_HOURS."""

from __future__ import annotations

import os
import threading

from apscheduler.schedulers.blocking import BlockingScheduler

from .ingest import run_once
from .serve import serve


def main() -> None:
    interval = float(os.getenv("SCRAPE_INTERVAL_HOURS", "6"))
    # Embed shim on a daemon thread — shares the one lru-cached model with the
    # scraper, so the app can embed resumes into the same vector space.
    threading.Thread(target=serve, daemon=True).start()
    print(f"[worker] embed shim on :{os.getenv('EMBED_PORT', '8080')}")
    run_once()  # once at boot so the DB fills immediately
    sched = BlockingScheduler(timezone="UTC")
    sched.add_job(run_once, "interval", hours=interval, coalesce=True, max_instances=1)
    print(f"[worker] scheduled every {interval}h; ctrl-c to stop")
    sched.start()


if __name__ == "__main__":
    main()
