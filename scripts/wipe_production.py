"""Wipe all production (or any) API data via authenticated owner call.

Usage:
  set FINNECT_API_BASE_URL=https://financeflow-api-gf0x.onrender.com
  python scripts/wipe_production.py

Requires an existing owner login (demo owner works until wiped).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.api_config import api_base

CONFIRM = "DELETE_ALL_DATA"


def request(method: str, path: str, data=None, token=None, form=False):
    url = f"{api_base()}{path}"
    headers = {}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        if form:
            body = data.encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"detail": raw}


def main() -> int:
    email = os.environ.get("WIPE_OWNER_EMAIL", "owner@financeflow.demo")
    password = os.environ.get("WIPE_OWNER_PASSWORD", "Owner@12345")
    base = api_base()
    print(f"Wiping ALL data on {base}")
    print(f"Logging in as {email} …")

    status, login = request(
        "POST",
        "/finance-owners/login",
        urllib.parse.urlencode({"username": email, "password": password}),
        form=True,
    )
    if status != 200:
        print("Login failed:", status, login)
        print("If demo owner is already gone, set WIPE_OWNER_EMAIL / WIPE_OWNER_PASSWORD.")
        return 1

    token = login["access_token"]
    status, resp = request(
        "POST",
        "/admin/wipe-all",
        {"confirm": CONFIRM},
        token=token,
    )
    print(status, json.dumps(resp, indent=2))
    if status != 200 or not resp.get("ok"):
        return 1
    print("\nDone. Database is empty. Register a new owner on the live site.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
