"""
AD Sync Scheduler
Calls /api/admin/ad-sync every 15 minutes using the AD_SYNC_SECRET from .env
"""

import os
import sys
import time
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (one level up from scripts/)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SYNC_URL = os.getenv("AD_SYNC_URL", "http://localhost:3000/api/admin/ad-sync")
SYNC_SECRET = os.getenv("AD_SYNC_SECRET", "")
INTERVAL_SECONDS = int(os.getenv("AD_SYNC_INTERVAL", "900"))  # 15 minutes default

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ad_sync")


def run_sync() -> None:
    if not SYNC_SECRET:
        log.error("AD_SYNC_SECRET is not set in .env — aborting")
        sys.exit(1)

    try:
        resp = requests.post(
            SYNC_URL,
            headers={
                "X-Sync-Secret": SYNC_SECRET,
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            log.info(
                "Sync OK — created: %d, updated: %d, skipped: %d, errors: %d",
                data.get("created", 0),
                data.get("updated", 0),
                data.get("skipped", 0),
                len(data.get("errors", [])),
            )
            if data.get("errors"):
                for err in data["errors"]:
                    log.warning("Sync error: %s", err)
        else:
            log.error("Sync failed: HTTP %d — %s", resp.status_code, resp.text[:200])
    except requests.exceptions.ConnectionError:
        log.error("Connection error — is the server running at %s?", SYNC_URL)
    except requests.exceptions.Timeout:
        log.error("Request timed out after 60s")
    except Exception as exc:  # pylint: disable=broad-except
        log.error("Unexpected error: %s", exc)


def main() -> None:
    log.info("AD Sync Scheduler started (interval: %ds, url: %s)", INTERVAL_SECONDS, SYNC_URL)
    while True:
        run_sync()
        log.info("Next sync in %d seconds", INTERVAL_SECONDS)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
