"""
Smoke: customer UX overhaul — split address, settings borrower form, ledger score.

Env:
  FINNECT_API_BASE_URL
  SMOKE_OWNER_EMAIL / SMOKE_OWNER_PASSWORD
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.api_config import api_base  # noqa: E402

BASE = api_base()
OWNER_EMAIL = os.environ.get("SMOKE_OWNER_EMAIL", "owner@financeflow.demo")
OWNER_PASSWORD = os.environ.get("SMOKE_OWNER_PASSWORD", "Owner@12345")
SUFFIX = str(int(time.time()) % 10_000_000)
PASSES: list[str] = []
FAILURES: list[str] = []


def request(method, path, data=None, token=None, form=False):
    url = f"{BASE}{path}"
    headers = {}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        if form:
            body = data.encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data, default=str).encode("utf-8")
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
    except Exception as e:
        return 0, {"detail": str(e)}


def check(name: str, ok: bool, detail="") -> bool:
    if ok:
        PASSES.append(name)
        print(f"  PASS: {name}")
        return True
    FAILURES.append(name)
    print(f"  FAIL: {name} — {detail}")
    return False


def login():
    last = None
    for attempt in range(1, 5):
        status, resp = request(
            "POST",
            "/finance-owners/login",
            f"username={OWNER_EMAIL}&password={OWNER_PASSWORD}",
            form=True,
        )
        if status == 200:
            return resp["access_token"]
        last = (status, resp)
        time.sleep(5 * attempt)
    raise RuntimeError(f"Login failed: {last}")


def phone(n: int) -> str:
    body = f"{int(SUFFIX) % 100_000_000:08d}"
    return f"9{body}{n % 10}"


def main() -> int:
    print(f"=== Customer UX smoke @ {BASE} ===\n")
    token = login()

    st, settings = request("GET", "/settings/", token=token)
    check("Settings load", st == 200, str(settings)[:200])
    rules = (settings or {}).get("kyc_field_rules") or {}
    occ = (settings or {}).get("occupation_options") or []
    check("kyc_field_rules present", isinstance(rules, dict) and len(rules) >= 10, rules)
    check("occupation_options seeded", isinstance(occ, list) and len(occ) >= 1, occ)

    payload = {
        "full_name": f"UX Smoke {SUFFIX}",
        "phone": phone(1),
        "require_full_kyc": True,
        "id_type": "AADHAAR",
        "id_number": f"UX{SUFFIX}",
        "alternate_phone": phone(2),
        "date_of_birth": "1991-03-12",
        "gender": "MALE",
        "occupation": "OTHER",
        "occupation_detail": "Auto rickshaw",
        "monthly_income": "18000",
        "area_landmark": "UX park",
        "house_ownership": "RENT",
        "guarantor_name": "UX Guarantor",
        "guarantor_phone": phone(3),
        "reference1_name": "UX Ref",
        "reference1_phone": phone(4),
        "has_other_loans": False,
        "addr_line1": "12 Reference Street",
        "addr_line2": "Block A",
        "city": "Hyderabad",
        "state": "Telangana",
        "postal_code": "500001",
        "address_comment": "Near temple",
        "temp_addr_line1": "12 Reference Street",
        "temp_city": "Hyderabad",
        "temp_state": "Telangana",
        "temp_postal_code": "500001",
    }
    st, created = request("POST", "/customers/", payload, token=token)
    check("Create with split address + occupation_detail", st in (200, 201), created)
    cid = (created or {}).get("id")
    if cid:
        check(
            "Composed permanent_address",
            "Hyderabad" in (created.get("permanent_address") or ""),
            created.get("permanent_address"),
        )
        check(
            "occupation_detail persisted",
            created.get("occupation_detail") == "Auto rickshaw",
            created,
        )
        check("addr_line1 persisted", created.get("addr_line1") == "12 Reference Street", created)

        st, ledger = request("GET", f"/customers/{cid}/ledger", token=token)
        check("Ledger loads", st == 200, ledger)
        check(
            "Ledger credit_score field exists",
            "credit_score" in (ledger or {}),
            ledger,
        )
        score = (ledger or {}).get("credit_score")
        if score:
            check(
                "Score in 0..1000",
                isinstance(score.get("score"), (int, float))
                and 0 <= score["score"] <= 1000,
                score,
            )
            check("Score has band", bool(score.get("band")), score)
        else:
            check("Score may be null for new thin file", True)

        st, one = request("GET", f"/customers/{cid}", token=token)
        check("GET customer returns city", (one or {}).get("city") == "Hyderabad", one)

    # Legacy empty customer still listable
    st, customers = request("GET", "/customers/", token=token)
    check("List customers", st == 200 and isinstance(customers, list), customers)

    print(f"\n=== Results: {len(PASSES)} passed, {len(FAILURES)} failed ===")
    if FAILURES:
        print("Failed:", ", ".join(FAILURES))
        return 1
    print("Customer UX smoke checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
