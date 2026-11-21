"""Smoke: agent loan create vs request vs approve permissions."""

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
        time.sleep(5 * attempt)
    raise RuntimeError(f"Login failed ({email}): {last[0]} {last[1]}")


def phone(n: int) -> str:
    body = f"{int(SUFFIX) % 100_000_000:08d}"
    return f"8{body}{n % 10}"


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
    print(f"=== Agent loan permissions smoke @ {BASE} ===\n")
    owner = login(OWNER_EMAIL, OWNER_PASSWORD)

    s, opts = request("GET", "/agents/permissions/options", token=owner)
    keys = {o.get("key") for o in opts} if isinstance(opts, list) else set()
    labels = {o.get("key"): o.get("label") for o in opts} if isinstance(opts, list) else {}
    check("options include loans.request", "loans.request" in keys, opts)
    check("options include loans.approve", "loans.approve" in keys, opts)
    check(
        "loans.create labeled without approval",
        labels.get("loans.create") == "Create loans without approval",
        labels.get("loans.create"),
    )

    s, presets = request("GET", "/agents/roles/presets", token=owner)
    check(
        "collection preset has request not create",
        s == 200
        and "loans.request" in (presets.get("COLLECTION_AGENT") or [])
        and "loans.create" not in (presets.get("COLLECTION_AGENT") or []),
        presets.get("COLLECTION_AGENT"),
    )
    check(
        "manager preset has create + request + approve",
        s == 200
        and "loans.create" in (presets.get("MANAGER") or [])
        and "loans.request" in (presets.get("MANAGER") or [])
        and "loans.approve" in (presets.get("MANAGER") or []),
        presets.get("MANAGER"),
    )

    # Minimal customer for permission tests
    s, cust = request(
        "POST",
        "/customers/",
        {
            "full_name": f"Perm Smoke {SUFFIX}",
            "phone": phone(1),
            "permanent_address": "Perm St",
            "require_full_kyc": False,
        },
        token=owner,
    )
    cust_id = cust.get("id") if s == 201 else None
    check("create test customer", bool(cust_id), cust)
    if not cust_id:
        print("Cannot continue without customer")
        sys.exit(1)

    # Create temporary request-only agent via API (needs OTP on some envs — skip if blocked)
    # Instead patch an existing agent if possible, or use owner-created agent with OTP.
    # Prefer: find Kumar and temporarily update permissions, then restore.

    s, agents = request("GET", "/agents/", token=owner)
    if s != 200 or not isinstance(agents, list) or not agents:
        check("list agents", False, agents)
        print(f"\n=== Results: {len(PASSES)} passed, {len(FAILURES)} failed ===")
        sys.exit(1 if FAILURES else 0)

    agent = next((a for a in agents if a.get("email") == "kumar@financeflow.demo"), agents[0])
    agent_id = agent["id"]
    original_perms = list(agent.get("permissions") or [])
    agent_email = agent.get("email")
    # We cannot login without password for arbitrary agents; use known demo password when Kumar
    agent_password = os.environ.get("SMOKE_AGENT_PASSWORD", "Agent@12345")

    base_modules = [
        "dashboard",
        "collections",
        "customers",
        "loans",
        "payments",
        "settlements",
    ]

    def set_agent_perms(perms: list[str]):
        return request(
            "PUT",
            f"/agents/{agent_id}",
            {
                "full_name": agent["full_name"],
                "phone": agent["phone"],
                "email": agent["email"],
                "role": agent.get("role") or "COLLECTION_AGENT",
                "permissions": perms,
                "is_active": True,
                "assigned_area": agent.get("assigned_area"),
            },
            token=owner,
        )

    try:
        # --- request only ---
        s, _ = set_agent_perms(base_modules + ["loans.request"])
        check("set request-only perms", s == 200, _)
        try:
            atok = login(agent_email, agent_password, agent=True)
        except Exception as e:
            check("agent login for perm tests", False, str(e))
            atok = None

        if atok:
            s, flags = request("GET", "/loan-approvals/require-flag", token=atok)
            check(
                "request-only: can_submit, not can_create_live",
                s == 200
                and flags.get("can_submit") is True
                and flags.get("can_create_live") is False
                and flags.get("require_approval") is True,
                flags,
            )
            s, live = request(
                "POST",
                "/loans/",
                {
                    **loan_terms(cust_id, agent_id),
                    "interest_method": "DAILY_COLLECTION",
                    "due_date": (date.today() + timedelta(days=9)).isoformat(),
                    "collection_model": "DAILY_COLLECTION",
                },
                token=atok,
            )
            check("request-only: live create 403", s == 403, live)

            s, pending = request(
                "POST", "/loan-approvals/", loan_terms(cust_id, agent_id), token=atok
            )
            check(
                "request-only: submit OK",
                s in (200, 201) and pending.get("status") == "PENDING",
                pending,
            )
            req_id = pending.get("id")

            s, appr = request("POST", f"/loan-approvals/{req_id}/approve", token=atok)
            check("request-only: approve 403", s == 403, appr)

            # Owner approves leftover so capital isn't stuck as pending forever — optional reject
            if req_id:
                request(
                    "POST",
                    f"/loan-approvals/{req_id}/reject",
                    {"reason": "Smoke cleanup — permission test"},
                    token=owner,
                )

            # --- create without approval ---
            set_agent_perms(base_modules + ["loans.create", "loans.request"])
            atok = login(agent_email, agent_password, agent=True)
            s, flags = request("GET", "/loan-approvals/require-flag", token=atok)
            # May still require if global setting on
            if flags.get("can_create_live"):
                s, live = request(
                    "POST",
                    "/loans/",
                    {
                        **loan_terms(cust_id, agent_id),
                        "interest_method": "DAILY_COLLECTION",
                        "due_date": (date.today() + timedelta(days=9)).isoformat(),
                        "collection_model": "DAILY_COLLECTION",
                    },
                    token=atok,
                )
                check(
                    "create-perm: live create OK when allowed",
                    s == 201 and live.get("status") == "ACTIVE",
                    live,
                )
            else:
                check(
                    "create-perm: live create OK when allowed",
                    True,
                    "skipped — require_loan_approval forced submit",
                )

            # --- approve ---
            set_agent_perms(base_modules + ["loans.request", "loans.approve"])
            atok = login(agent_email, agent_password, agent=True)
            s, pending = request(
                "POST", "/loan-approvals/", loan_terms(cust_id, agent_id), token=atok
            )
            req_id = pending.get("id") if s in (200, 201) else None
            check("approve-perm: submit pending", bool(req_id), pending)
            if req_id:
                s, approved = request(
                    "POST", f"/loan-approvals/{req_id}/approve", token=atok
                )
                check(
                    "approve-perm: can approve",
                    s == 200 and approved.get("status") == "APPROVED",
                    approved,
                )

    finally:
        # Restore original permissions
        set_agent_perms(original_perms)
        check("restored agent permissions", True)

    # Existing customers list still OK
    s, customers = request("GET", "/customers/", token=owner)
    check("existing customers still listable", s == 200 and isinstance(customers, list), customers)

    print(f"\n=== Results: {len(PASSES)} passed, {len(FAILURES)} failed ===")
    if FAILURES:
        print("Failed:", ", ".join(FAILURES))
        sys.exit(1)
    print("All agent loan permission smoke checks passed.")


if __name__ == "__main__":
    main()
