"""Seed FinanceFlow with fixed demo credentials and mock lending data."""

import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

from scripts.api_config import api_base

BASE = api_base()

# Fixed credentials for manual UI testing
OWNER_EMAIL = "owner@financeflow.demo"
OWNER_PASSWORD = "Owner@12345"
OWNER_PHONE = "9876543210"

AGENT_EMAIL = "kumar@financeflow.demo"
AGENT_PASSWORD = "Agent@12345"
AGENT_PHONE = "9876543211"

MANAGER_EMAIL = "manager@financeflow.demo"
MANAGER_PASSWORD = "Manager@12345"


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


def ensure_customer(token, data):
    status, resp = request("POST", "/customers/", data, token=token)
    if status in (200, 201) and "id" in resp:
        return resp["id"]
    _, customers = request("GET", "/customers/", token=token)
    for c in customers:
        if c.get("phone") == data["phone"]:
            return c["id"]
    raise RuntimeError(f"Customer failed: {status} {resp}")


def main():
    # Register owner (ignore if exists)
    status, reg = request(
        "POST",
        "/finance-owners/register",
        {
            "business_name": "FinanceFlow Demo Lending",
            "owner_name": "Rajesh Owner",
            "phone": OWNER_PHONE,
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "address": "Main Office, Hyderabad",
        },
    )
    if status not in (200, 201) and status != 400:
        print("Owner register failed:", status, reg)
        sys.exit(1)

    owner_token = login(OWNER_EMAIL, OWNER_PASSWORD)
    issue = date.today().isoformat()
    due = (date.today() + timedelta(days=100)).isoformat()

    # Capital
    request(
        "POST",
        "/capital/add",
        {"amount": "100000.00", "description": "Initial business capital"},
        token=owner_token,
    )

    borrowers = [
        {
            "full_name": "Ravi Kumar",
            "phone": "7010001001",
            "permanent_address": "12 MG Road, Secunderabad",
            "temporary_address": "Near bus stand",
        },
        {
            "full_name": "Suresh Reddy",
            "phone": "7010001002",
            "permanent_address": "45 Market Street, Hyderabad",
            "temporary_address": None,
        },
        {
            "full_name": "Mani Sharma",
            "phone": "7010001003",
            "permanent_address": "78 Old City, Hyderabad",
            "temporary_address": "Shop no 5",
        },
        {
            "full_name": "Anitha Devi",
            "phone": "7010001004",
            "permanent_address": "22 Lake View, Gachibowli",
            "temporary_address": None,
        },
    ]

    customer_ids = []
    loan_ids = []

    for b in borrowers:
        cid = ensure_customer(owner_token, b)
        customer_ids.append(cid)
        _, loan = request(
            "POST",
            "/loans/",
            {
                "customer_id": cid,
                "principal_amount": "10000.00",
                "interest_method": "DAILY_COLLECTION",
                "interest_rate": "20",
                "issue_date": issue,
                "due_date": due,
                "collection_model": "DAILY_COLLECTION",
                "duration_days": 100,
                "daily_payment": "120.00",
                "daily_principal": "100.00",
                "daily_profit": "20.00",
            },
            token=owner_token,
        )
        loan_ids.append(loan["id"])

    # Collection agent Kumar
    status, agent = request(
        "POST",
        "/agents/",
        {
            "full_name": "Kumar (Collection Agent)",
            "phone": AGENT_PHONE,
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD,
            "role": "COLLECTION_AGENT",
            "assigned_area": "Secunderabad Zone A",
            "is_active": True,
        },
        token=owner_token,
    )
    if status in (200, 201) and "id" in agent:
        agent_id = agent["id"]
    else:
        _, agents = request("GET", "/agents/", token=owner_token)
        agent_id = next((a["id"] for a in agents if a.get("email") == AGENT_EMAIL), None)
        if not agent_id:
            raise RuntimeError(f"Agent create failed: {status} {agent}")

    # Manager (optional second login)
    request(
        "POST",
        "/agents/",
        {
            "full_name": "Priya Manager",
            "phone": "9876543212",
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD,
            "role": "MANAGER",
            "assigned_area": "All zones",
            "is_active": True,
        },
        token=owner_token,
    )

    # Assign first 3 borrowers to Kumar
    request(
        "POST",
        f"/agents/{agent_id}/assignments",
        {"customer_ids": customer_ids[:3]},
        token=owner_token,
    )

    creds = {
        "owner": {
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "login_tab": "Owner",
        },
        "collection_agent": {
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD,
            "login_tab": "Agent",
            "name": "Kumar (Collection Agent)",
        },
        "manager": {
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD,
            "login_tab": "Agent",
        },
        "data": {
            "capital_added": "100000.00",
            "borrowers": len(customer_ids),
            "loans": len(loan_ids),
            "loan_ids": loan_ids,
            "customer_ids": customer_ids,
            "agent_id": agent_id,
            "assigned_to_kumar": customer_ids[:3],
        },
        "urls": {
            "api": BASE,
            "frontend": "http://localhost:5173",
        },
        "message": "Fresh demo data ready. Log in as owner or agent to test collections and settlements.",
    }

    print(json.dumps(creds, indent=2))

    print("\n--- Seeding demo pages (defaults, renewals, reconciliation) ---")
    import os
    import subprocess

    env = {**os.environ, "FINNECT_API_BASE_URL": BASE, "PYTHONPATH": str(Path(__file__).resolve().parents[1])}
    subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parent / "demo_pages_seed.py")],
        check=False,
        env=env,
    )


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print("API not reachable at", BASE, "- start backend first.", e)
        sys.exit(1)
    except Exception as e:
        print("Seed failed:", e)
        sys.exit(1)
