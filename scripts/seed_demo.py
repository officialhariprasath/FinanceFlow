"""Seed demo data for FinanceFlow MVP."""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
RUN_ID = str(int(time.time()))[-5:]
EMAIL = f"demo{RUN_ID}@financeflow.demo"
PASSWORD = "Demo@12345"


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
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else {}


def main():
    request(
        "POST",
        "/finance-owners/register",
        {
            "business_name": "Demo Lending Co",
            "owner_name": "Demo Owner",
            "phone": f"8{RUN_ID}"[:10].rjust(10, "0"),
            "email": EMAIL,
            "password": PASSWORD,
            "address": "Demo Street",
        },
    )
    _, token_resp = request(
        "POST",
        "/finance-owners/login",
        f"username={EMAIL}&password={PASSWORD}",
        form=True,
    )
    token = token_resp["access_token"]
    issue = date.today().isoformat()
    due = (date.today() + timedelta(days=100)).isoformat()

    request(
        "POST",
        "/capital/add",
        {"amount": "50000.00", "description": "Demo initial capital"},
        token=token,
    )

    borrowers = [
        ("Ravi Kumar", "7010000001"),
        ("Suresh Reddy", "7010000002"),
        ("Anitha Devi", "7010000003"),
    ]

    for name, phone in borrowers:
        _, customer = request(
            "POST",
            "/customers/",
            {"full_name": name, "phone": phone, "address": "Hyderabad"},
            token=token,
        )
        request(
            "POST",
            "/loans/",
            {
                "customer_id": customer["id"],
                "principal_amount": "10000.00",
                "interest_method": "DAILY_COLLECTION",
                "interest_rate": "0",
                "issue_date": issue,
                "due_date": due,
                "collection_model": "DAILY_COLLECTION",
                "duration_days": 100,
                "daily_payment": "120.00",
                "daily_principal": "100.00",
                "daily_profit": "20.00",
            },
            token=token,
        )

    print(json.dumps({
        "email": EMAIL,
        "password": PASSWORD,
        "message": "Demo account seeded with 50k capital and 3 daily-collection loans.",
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(e.read().decode())
        sys.exit(1)
