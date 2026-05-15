"""
SLA check cron runner.
Calls /api/cron/sla-check     every CRON_INTERVAL seconds  (default: 30).
Calls /api/cron/sla-overdue   every 300 seconds (5 minutes, configurable via CRON_OVERDUE_INTERVAL).
Calls /api/cron/absence-expire once per hour.

Usage:
    python sla_cron.py [--url http://localhost:3000] [--secret YOUR_SECRET] [--interval 30] [--overdue-interval 300]

Environment variables (override CLI args):
    CRON_BASE_URL        — base URL of the Next.js app  (default: http://localhost:3000)
    CRON_SECRET          — Bearer token sent as Authorization header
    CRON_INTERVAL        — sla-check polling interval in seconds  (default: 30)
    CRON_OVERDUE_INTERVAL — sla-overdue polling interval in seconds  (default: 300)
"""

import argparse
import os
import time
import urllib.request
import urllib.error
import json
from datetime import datetime
from pathlib import Path


def load_dotenv(path: str = ".env") -> None:
    """Load key=value pairs from a .env file into os.environ (existing vars take priority)."""
    env_file = Path(path)
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SLA check cron runner")
    parser.add_argument("--url", default=None, help="Base URL of the app")
    parser.add_argument("--secret", default=None, help="CRON_SECRET value")
    parser.add_argument("--interval", type=int, default=None, help="sla-check interval in seconds (default: 30)")
    parser.add_argument("--overdue-interval", type=int, default=None, dest="overdue_interval",
                        help="sla-overdue interval in seconds (default: 300)")
    return parser.parse_args()


def call_endpoint(endpoint: str, secret: str | None, method: str = "GET") -> None:
    req = urllib.request.Request(endpoint, method=method)
    if secret:
        req.add_header("Authorization", f"Bearer {secret}")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                data = body
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] {method} {endpoint} → {resp.status} {data}")
    except urllib.error.HTTPError as exc:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] HTTP {exc.code}: {exc.reason}  ({endpoint})")
    except urllib.error.URLError as exc:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] Connection error: {exc.reason}  ({endpoint})")
    except TimeoutError:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] Timeout  ({endpoint})")


def main() -> None:
    load_dotenv()
    args = parse_args()

    base_url        = args.url or os.environ.get("CRON_BASE_URL", "http://localhost:3000")
    secret          = args.secret or os.environ.get("CRON_SECRET")
    interval        = args.interval or int(os.environ.get("CRON_INTERVAL", "30"))
    overdue_interval = args.overdue_interval or int(os.environ.get("CRON_OVERDUE_INTERVAL", "300"))

    base = base_url.rstrip("/")
    sla_endpoint     = base + "/api/cron/sla-check"
    overdue_endpoint = base + "/api/cron/sla-overdue"
    absence_endpoint = base + "/api/cron/absence-expire"

    # How many sla-check ticks between each overdue / absence call
    overdue_every = max(1, overdue_interval // interval)
    absence_every = max(1, 3600 // interval)

    print(f"SLA check:      {sla_endpoint}     every {interval}s")
    print(f"SLA overdue:    {overdue_endpoint}  every {overdue_every * interval}s (~{overdue_interval}s requested)")
    print(f"Absence expire: {absence_endpoint}  every {absence_every * interval}s")
    if not secret:
        print("Warning: no CRON_SECRET — requests sent without Authorization header")

    ticks = 0
    # Fire overdue and absence immediately on start (ticks == 0), then on schedule
    while True:
        call_endpoint(sla_endpoint, secret, method="GET")

        if ticks % overdue_every == 0:
            call_endpoint(overdue_endpoint, secret, method="GET")

        if ticks % absence_every == 0:
            call_endpoint(absence_endpoint, secret, method="POST")

        ticks += 1
        time.sleep(interval)


if __name__ == "__main__":
    main()
