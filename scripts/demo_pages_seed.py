"""Add demo data for Defaults, Renewals, and Reconciliation UI testing.

Run after backend is up (works on existing seeded database):

    python scripts/demo_pages_seed.py
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from scripts.api_config import api_base

BASE = api_base()
OWNER_EMAIL = "owner@financeflow.demo"
OWNER_PASSWORD = "Owner@12345"
AGENT_EMAIL = "kumar@financeflow.demo"
AGENT_PASSWORD = "Agent@12345"


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
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"detail": raw}


def login(email, password, agent=False):
    path = "/agents/login" if agent else "/finance-owners/login"
    status, resp = request(
        "POST",
        path,
        f"username={email}&password={password}",
        form=True,
    )
    if status != 200:
        raise RuntimeError(f"Login failed for {email}: {status} {resp}")
    return resp["access_token"]


def create_customer(token, full_name, phone):
    status, resp = request(
        "POST",
        "/customers/",
        {
            "full_name": full_name,
            "phone": phone,
            "permanent_address": "Demo address for UI testing",
            "temporary_address": None,
        },
        token=token,
    )
    if status in (200, 201) and "id" in resp:
        return resp["id"]
    # Already exists — find by listing
    _, customers = request("GET", "/customers/", token=token)
    for c in customers:
        if c.get("phone") == phone:
            return c["id"]
    raise RuntimeError(f"Could not create/find customer {phone}: {status} {resp}")


def create_daily_loan(token, customer_id, issue_date, due_date, principal="8000.00"):
    status, loan = request(
        "POST",
        "/loans/",
        {
            "customer_id": customer_id,
            "principal_amount": principal,
            "interest_method": "DAILY_COLLECTION",
            "interest_rate": "20",
            "issue_date": issue_date,
            "due_date": due_date,
            "collection_model": "DAILY_COLLECTION",
            "duration_days": 100,
            "daily_payment": "96.00",
            "daily_principal": "80.00",
            "daily_profit": "16.00",
        },
        token=token,
    )
    if status not in (200, 201):
        raise RuntimeError(f"Loan create failed: {status} {loan}")
    return loan["id"]


def main():
    today = date.today()
    owner_token = login(OWNER_EMAIL, OWNER_PASSWORD)

    results = {"overdue_loan_id": None, "renewal_loan_id": None, "agent_collection": None}

    # --- Overdue loan for Defaults page ---
    overdue_issue = (today - timedelta(days=20)).isoformat()
    overdue_due = (today + timedelta(days=80)).isoformat()
    overdue_cust = create_customer(
        owner_token,
        "Venkatesh (Overdue Demo)",
        "7010002099",
    )
    overdue_loan_id = create_daily_loan(
        owner_token,
        overdue_cust,
        overdue_issue,
        overdue_due,
        principal="5000.00",
    )
    results["overdue_loan_id"] = overdue_loan_id

    # Trigger overdue marking + verify defaults API
    status, overdue_rows = request("GET", "/defaults/overdue", token=owner_token)
    results["overdue_count"] = len(overdue_rows) if status == 200 else 0

    # --- Loan renewal for Renewals page ---
    _, loans = request("GET", "/loans/", token=owner_token)
    active = [l for l in loans if l.get("status") == "ACTIVE"]
    if active:
        renew_loan_id = active[0]["id"]
        new_due = (today + timedelta(days=150)).isoformat()
        status, renewal = request(
            "POST",
            f"/loan/{renew_loan_id}/renew",
            {
                "renewal_type": "CONTINUE",
                "new_due_date": new_due,
                "interest_method": "PERCENTAGE",
                "interest_rate": "3",
                "remarks": "Demo renewal — extended for UI testing",
            },
            token=owner_token,
        )
        if status in (200, 201):
            results["renewal_loan_id"] = renew_loan_id
            results["renewal_id"] = renewal.get("id")
        else:
            results["renewal_error"] = renewal

    # --- Agent wallet cash for Reconciliation (new loan today, assigned to Kumar) ---
    try:
        agent_token = login(AGENT_EMAIL, AGENT_PASSWORD, agent=True)
        _, agents = request("GET", "/agents/", token=owner_token)
        agent_id = next((a["id"] for a in agents if a.get("email") == AGENT_EMAIL), None)
        recon_cust = create_customer(
            owner_token,
            "Deepak (Recon Demo)",
            "7010002199",
        )
        if agent_id:
            request(
                "POST",
                f"/agents/{agent_id}/assignments",
                {"customer_ids": [recon_cust]},
                token=owner_token,
            )
        issue_today = today.isoformat()
        recon_due = (today + timedelta(days=60)).isoformat()
        recon_loan_id = create_daily_loan(
            owner_token,
            recon_cust,
            issue_today,
            recon_due,
            principal="3000.00",
        )
        status, collections = request("GET", "/collections/today", token=agent_token)
        unpaid = None
        if status == 200 and collections.get("items"):
            unpaid = next(
                (i for i in collections["items"] if i.get("status") != "PAID"),
                None,
            )
        if unpaid:
            pay_status, pay_resp = request(
                "POST",
                "/payments/",
                {
                    "loan_id": unpaid["loan_id"],
                    "payment_date": unpaid["schedule_date"],
                    "amount_paid": unpaid.get("pending_amount", "120.00"),
                    "payment_mode": "Cash",
                    "remarks": "Demo collection for reconciliation",
                    "schedule_dates": [unpaid["schedule_date"]],
                },
                token=agent_token,
            )
            if pay_status in (200, 201):
                results["agent_collection"] = unpaid["loan_id"]
            else:
                results["agent_collection_error"] = pay_resp
        else:
            results["agent_collection"] = f"loan {recon_loan_id} created; no unpaid in today list"
    except RuntimeError:
        results["agent_collection"] = "skipped (agent login failed)"

    # Reconciliation snapshot
    status, rec = request("GET", "/ledger/reconciliation", token=owner_token)
    if status == 200:
        results["reconciliation"] = {
            "unsettled_with_agents": rec.get("unsettled_with_agents"),
            "is_balanced": rec.get("is_balanced"),
            "pending_settlement_count": rec.get("pending_settlement_count"),
        }

    print(json.dumps({"ok": True, "results": results}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print("API not reachable at", BASE, "- start backend first.", e)
        sys.exit(1)
    except Exception as e:
        print("Demo seed failed:", e)
        sys.exit(1)
