"""
SLA check cron runner.
Calls /api/cron/sla-check every 30 seconds.

Usage:
    python sla_cron.py [--url http://localhost:3000] [--secret YOUR_SECRET] [--interval 30]

Environment variables (override CLI args):
    CRON_BASE_URL   — base URL of the Next.js app  (default: http://localhost:3000)
    CRON_SECRET     — Bearer token sent as Authorization header
    CRON_INTERVAL   — polling interval in seconds  (default: 30)
"""

import argparse
import os
import time
import urllib.request
import urllib.error
import json
from datetime import datetime


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SLA check cron runner")
    parser.add_argument("--url", default=None, help="Base URL of the app")
    parser.add_argument("--secret", default=None, help="CRON_SECRET value")
    parser.add_argument("--interval", type=int, default=None, help="Interval in seconds")
    return parser.parse_args()


def call_sla_check(endpoint: str, secret: str | None) -> None:
    req = urllib.request.Request(endpoint, method="GET")
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
            print(f"[{ts}] OK {resp.status} — {data}")
    except urllib.error.HTTPError as exc:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] HTTP {exc.code}: {exc.reason}")
    except urllib.error.URLError as exc:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] Connection error: {exc.reason}")


def main() -> None:
    args = parse_args()

    base_url = args.url or os.environ.get("CRON_BASE_URL", "http://localhost:3000")
    secret   = args.secret or os.environ.get("CRON_SECRET")
    interval = args.interval or int(os.environ.get("CRON_INTERVAL", "30"))

    endpoint = base_url.rstrip("/") + "/api/cron/sla-check"
    print(f"Polling {endpoint} every {interval}s  (Ctrl+C to stop)")
    if not secret:
        print("Warning: no CRON_SECRET — requests sent without Authorization header")

    while True:
        call_sla_check(endpoint, secret)
        time.sleep(interval)


if __name__ == "__main__":
    main()
