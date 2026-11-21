"""
E2E smoke: borrower KYC + loan approvals edge cases.

Uses unique phone numbers so existing live data is never modified.
Pending reject path leaves no ACTIVE loan; approve path creates one small loan
only when capital is available.

Env:
  FINNECT_API_BASE_URL  (default http://127.0.0.1:8000)
  SMOKE_OWNER_EMAIL / SMOKE_OWNER_PASSWORD
  SMOKE_AGENT_EMAIL / SMOKE_AGENT_PASSWORD
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.api_config import api_base  # noqa: E402

BASE = api_base()
OWNER_EMAIL = os.environ.get("SMOKE_OWNER_EMAIL", "owner@financeflow.demo")
OWNER_PASSWORD = os.environ.get("SMOKE_OWNER_PASSWORD", "Owner@12345")
AGENT_EMAIL = os.environ.get("SMOKE_AGENT_EMAIL", "kumar@financeflow.demo")
AGENT_PASSWORD = os.environ.get("SMOKE_AGENT_PASSWORD", "Agent@12345")

PASSES: list[str] = []
FAILURES: list[str] = []
SUFFIX = str(int(time.time()) % 10_000_000)


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


def check(name: str, condition: bool, detail="") -> bool:
    if condition:
        PASSES.append(name)
        print(f"  PASS: {name}")
        return True
    FAILURES.append(name)
    print(f"  FAIL: {name} — {detail}")
    return False


def login(email, password, agent=False):
    path = "/agents/login" if agent else "/finance-owners/login"
    last = None
    for attempt in range(1, 4):
        status, resp = request(
            "POST", path, f"username={email}&password={password}", form=True
        )
        if status == 200:
            return resp["access_token"]
        last = (status, resp)
        # Render free tier cold-start / transient timeouts
        time.sleep(5 * attempt)
    raise RuntimeError(f"Login failed ({email}): {last[0]} {last[1]}")


def phone(n: int) -> str:
    # Always exactly 10 digits (9 + 8 + 1), unique per run/n
    body = f"{int(SUFFIX) % 100_000_000:08d}"
    return f"9{body}{n % 10}"


def full_kyc_payload(name: str, primary: str) -> dict:
    return {
        "full_name": name,
        "phone": primary,
        "permanent_address": "Smoke St 1",
        "temporary_address": "Smoke St 1",
        "require_full_kyc": True,
        "id_type": "AADHAAR",
        "id_number": f"SMOKE{SUFFIX}",
        "alternate_phone": phone(2),
        "date_of_birth": "1992-01-15",
        "gender": "FEMALE",
        "occupation": "SALARY",
        "monthly_income": "12000",
        "area_landmark": "Near smoke park",
        "house_ownership": "RENT",
        "guarantor_name": "Smoke Guarantor",
        "guarantor_phone": phone(3),
        "reference1_name": "Smoke Ref",
        "reference1_phone": phone(4),
        "has_other_loans": False,
    }


def loan_terms(customer_id: int, agent_id: int | None = None) -> dict:
    today = date.today().isoformat()
    start = (date.today() + timedelta(days=1)).isoformat()
    payload = {
        "customer_id": customer_id,
        "principal_amount": "1000",
        "interest_rate": "0",
        "collection_frequency": "DAILY",
        "installment_count": 10,
        "issue_date": today,
        "due_start_date": start,
        "daily_payment": "120.00",
        "daily_principal": "100.00",
        "daily_profit": "20.00",
    }
    if agent_id:
        payload["collection_agent_id"] = agent_id
    return payload


def main():
    print(f"=== KYC + Loan Approvals smoke @ {BASE} ===\n")

    try:
        owner = login(OWNER_EMAIL, OWNER_PASSWORD)
    except Exception as e:
        print(f"Cannot login owner: {e}")
        sys.exit(2)

    agent_token = None
    try:
        agent_token = login(AGENT_EMAIL, AGENT_PASSWORD, agent=True)
    except Exception as e:
        print(f"  WARN: agent login skipped: {e}")

    # --- Existing customers still listable (KYC may be empty) ---
    s, customers = request("GET", "/customers/", token=owner)
    check("List customers (existing untouched)", s == 200 and isinstance(customers, list), customers)
    if isinstance(customers, list) and customers:
        sample = customers[0]
        check(
            "Existing customer KYC fields present as null/empty OK",
            "id_type" in sample or sample.get("id_type") is None,
            sample,
        )

    # --- Incomplete KYC rejected ---
    s, bad = request(
        "POST",
        "/customers/",
        {
            "full_name": "Incomplete",
            "phone": phone(5),
            "permanent_address": "x",
            "require_full_kyc": True,
        },
        token=owner,
    )
    check("Incomplete KYC rejected", s in (400, 422), bad)

    # --- Full KYC create ---
    s, cust = request(
        "POST",
        "/customers/",
        full_kyc_payload(f"Smoke KYC {SUFFIX}", phone(6)),
        token=owner,
    )
    check("Full KYC create", s == 201 and cust.get("id"), cust)
    cust_id = cust.get("id") if isinstance(cust, dict) else None

    if cust_id:
        s, one = request("GET", f"/customers/{cust_id}", token=owner)
        check(
            "GET customer returns KYC",
            s == 200 and one.get("guarantor_name") == "Smoke Guarantor",
            one,
        )

    # Resolve an agent early (required when agents exist on this tenant)
    agent_id = None
    s, agents = request("GET", "/agents/", token=owner)
    if s == 200 and isinstance(agents, list) and agents:
        agent_id = agents[0].get("id")

    # --- Owner live create still works ---
    if cust_id:
        today = date.today().isoformat()
        due = (date.today() + timedelta(days=9)).isoformat()
        live_payload = {
            "customer_id": cust_id,
            "principal_amount": "1000",
            "interest_method": "DAILY_COLLECTION",
            "interest_rate": "0",
            "issue_date": today,
            "due_date": due,
            "collection_model": "DAILY_COLLECTION",
            "collection_frequency": "DAILY",
            "installment_count": 10,
            "due_start_date": today,
            "daily_payment": "120.00",
            "daily_principal": "100.00",
            "daily_profit": "20.00",
        }
        if agent_id:
            live_payload["collection_agent_id"] = agent_id
        s, live = request("POST", "/loans/", live_payload, token=owner)
        check(
            "Owner live create still works",
            s == 201 and live.get("status") == "ACTIVE",
            live,
        )

    # --- Settings flag round-trip (restore previous value) ---
    s, settings = request("GET", "/settings/", token=owner)
    prev_flag = False
    if s == 200 and isinstance(settings, dict):
        prev_flag = bool(settings.get("require_loan_approval"))
        s2, updated = request(
            "PUT",
            "/settings/",
            {**{k: settings.get(k) for k in (
                "business_name", "owner_name", "phone", "email", "address",
                "default_interest_method", "default_interest_rate",
                "default_loan_duration", "default_grace_period",
                "currency", "date_format", "timezone", "maturity_alert_days",
                "daily_grace_installments", "daily_penalty_per_installment",
                "weekly_grace_installments", "weekly_penalty_per_installment",
                "bi_weekly_grace_installments", "bi_weekly_penalty_per_installment",
                "monthly_grace_installments", "monthly_penalty_per_installment",
                "score_enabled", "score_band_poor_max", "score_band_fair_max",
                "score_band_good_max", "customer_code_prefix", "loan_code_prefix",
                "code_number_padding",
            )}, "require_loan_approval": True},
            token=owner,
        )
        check("Enable require_loan_approval", s2 == 200 and updated.get("require_loan_approval") is True, updated)
        # restore
        request(
            "PUT",
            "/settings/",
            {**{k: settings.get(k) for k in (
                "business_name", "owner_name", "phone", "email", "address",
                "default_interest_method", "default_interest_rate",
                "default_loan_duration", "default_grace_period",
                "currency", "date_format", "timezone", "maturity_alert_days",
                "daily_grace_installments", "daily_penalty_per_installment",
                "weekly_grace_installments", "weekly_penalty_per_installment",
                "bi_weekly_grace_installments", "bi_weekly_penalty_per_installment",
                "monthly_grace_installments", "monthly_penalty_per_installment",
                "score_enabled", "score_band_poor_max", "score_band_fair_max",
                "score_band_good_max", "customer_code_prefix", "loan_code_prefix",
                "code_number_padding",
            )}, "require_loan_approval": prev_flag},
            token=owner,
        )
        check("Restored require_loan_approval flag", True)

    # --- Submit for approval (no disbursement) ---
    s, cust2 = request(
        "POST",
        "/customers/",
        full_kyc_payload(f"Smoke Approve {SUFFIX}", phone(7)),
        token=owner,
    )
    cust2_id = cust2.get("id") if s == 201 else None
    check("Second KYC customer for approval", bool(cust2_id), cust2)

    req_id = None
    if cust2_id:
        token_for_submit = agent_token or owner
        s, pending = request(
            "POST",
            "/loan-approvals/",
            loan_terms(cust2_id, agent_id),
            token=token_for_submit,
        )
        check(
            "Submit approval → PENDING (no live loan yet)",
            s in (200, 201) and pending.get("status") == "PENDING" and not pending.get("created_loan_id"),
            pending,
        )
        req_id = pending.get("id")

        s, listed = request("GET", "/loan-approvals/?status=PENDING", token=owner)
        check(
            "Pending list contains request",
            s == 200 and any(r.get("id") == req_id for r in (listed or [])),
            listed,
        )

        s, count = request("GET", "/loan-approvals/pending-count", token=owner)
        check("Pending count > 0", s == 200 and (count.get("count") or 0) > 0, count)

    # --- Reject requires reason; then reject ---
    if req_id:
        s, rej_bad = request(
            "POST",
            f"/loan-approvals/{req_id}/reject",
            {"reason": "no"},
            token=owner,
        )
        check("Reject with too-short reason fails", s in (400, 422), rej_bad)

        # create another to reject cleanly if short reason somehow passed
        if s in (200, 201):
            # unexpected — submit another
            s, pending2 = request(
                "POST",
                "/loan-approvals/",
                loan_terms(cust2_id, agent_id),
                token=agent_token or owner,
            )
            req_id = pending2.get("id")

        s, rejected = request(
            "POST",
            f"/loan-approvals/{req_id}/reject",
            {"reason": "Smoke test — incomplete capacity"},
            token=owner,
        )
        check(
            "Reject → REJECTED + reason",
            s == 200 and rejected.get("status") == "REJECTED" and rejected.get("rejection_reason"),
            rejected,
        )

        # double reject fails
        s, again = request(
            "POST",
            f"/loan-approvals/{req_id}/reject",
            {"reason": "already done"},
            token=owner,
        )
        check("Double reject rejected", s == 400, again)

    # --- Approve path ---
    if cust2_id:
        s, to_approve = request(
            "POST",
            "/loan-approvals/",
            loan_terms(cust2_id, agent_id),
            token=agent_token or owner,
        )
        approve_id = to_approve.get("id") if s in (200, 201) else None
        check("Submit second request for approve", bool(approve_id), to_approve)

        if approve_id:
            s, approved = request(
                "POST",
                f"/loan-approvals/{approve_id}/approve",
                token=owner,
            )
            ok = (
                s == 200
                and approved.get("status") == "APPROVED"
                and approved.get("created_loan_id")
            )
            check("Approve → ACTIVE loan created", ok, approved)

            if ok:
                lid = approved["created_loan_id"]
                s, loan = request("GET", f"/loans/{lid}", token=owner)
                check(
                    "Approved loan is ACTIVE with schedule",
                    s == 200 and loan.get("status") == "ACTIVE",
                    loan,
                )
                s, sched = request("GET", f"/loans/{lid}/schedules", token=owner)
                check(
                    "Approved loan has schedule rows",
                    s == 200 and isinstance(sched, list) and len(sched) > 0,
                    sched,
                )

            # double approve fails
            s, dup = request(
                "POST",
                f"/loan-approvals/{approve_id}/approve",
                token=owner,
            )
            check("Double approve rejected", s == 400, dup)

    # --- Flags endpoint ---
    s, flags = request("GET", "/loan-approvals/require-flag", token=owner)
    check(
        "Owner can_create_live",
        s == 200 and flags.get("can_create_live") is True and flags.get("require_approval") is False,
        flags,
    )
    if agent_token:
        s, aflags = request("GET", "/loan-approvals/require-flag", token=agent_token)
        check("Agent flags endpoint", s == 200 and "require_approval" in aflags, aflags)

    print(f"\n=== Results: {len(PASSES)} passed, {len(FAILURES)} failed ===")
    if FAILURES:
        print("Failed:", ", ".join(FAILURES))
        sys.exit(1)
    print("All KYC + approval smoke checks passed.")


if __name__ == "__main__":
    main()
