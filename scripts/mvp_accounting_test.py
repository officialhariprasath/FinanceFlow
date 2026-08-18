"""MVP accounting test: 50k capital, 5 loans, daily payments, reconcile."""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
RUN_ID = str(int(time.time()))[-6:]
EMAIL = f"mvp{RUN_ID}@testfinanceflow.com"
PASSWORD = "MvpTest!123"


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
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = raw
        return e.code, detail


def register_and_login():
    request(
        "POST",
        "/finance-owners/register",
        {
            "business_name": "MVP Finance",
            "owner_name": "MVP Owner",
            "phone": f"9{RUN_ID}"[:10].rjust(10, "0"),
            "email": EMAIL,
            "password": PASSWORD,
            "address": "Test",
        },
    )
    status, token_resp = request(
        "POST",
        "/finance-owners/login",
        f"username={EMAIL}&password={PASSWORD}",
        form=True,
    )
    if status != 200:
        print("login failed", status, token_resp)
        sys.exit(1)
    return token_resp["access_token"]


def main():
    token = register_and_login()
    issue = date.today().isoformat()

    status, _ = request(
        "POST",
        "/capital/add",
        {"amount": "50000.00", "description": "MVP seed capital"},
        token=token,
    )
    if status not in (200, 201):
        print("capital add failed", status)
        sys.exit(1)

    loan_ids = []
    for i in range(5):
        status, customer = request(
            "POST",
            "/customers/",
            {
                "full_name": f"MVP Borrower {i + 1}",
                "phone": f"7{RUN_ID}{i:02d}"[-10:],
                "address": "Test",
            },
            token=token,
        )
        if status not in (200, 201):
            print("customer failed", i, status, customer)
            sys.exit(1)

        due = (date.today() + timedelta(days=100)).isoformat()
        status, loan = request(
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
        if status not in (200, 201):
            print("loan failed", i, status, loan)
            sys.exit(1)
        loan_ids.append(loan["id"])

    for loan_id in loan_ids:
        status, payment = request(
            "POST",
            "/payments/",
            {
                "loan_id": loan_id,
                "payment_date": issue,
                "amount_paid": "120.00",
                "payment_mode": "cash",
            },
            token=token,
        )
        if status not in (200, 201):
            print("payment failed", loan_id, status, payment)
            sys.exit(1)

    status, capital = request("GET", "/capital/summary", token=token)
    status2, profit = request("GET", "/profit/summary", token=token)
    status3, ff = request("GET", "/dashboard/financeflow", token=token)

    # 50k - 50k lent + 500 principal recovered (5*100) = 500 available? 
    # Each loan 10k disbursement: 50k -> 0 after 5 loans
    # Each payment +100 principal: 5 * 100 = 500 back to capital
    expected_capital = "500.00"
    expected_profit = "100.00"  # 5 * 20

    checks = {
        "available_capital": capital.get("available_capital") == expected_capital,
        "available_profit": profit.get("available_profit") == expected_profit,
        "active_loans": ff.get("active_loans") == 5,
        "collected_today": ff.get("collected_today") == "600.00",
    }

    print(json.dumps({
        "capital": capital,
        "profit": profit,
        "financeflow": ff,
        "checks": checks,
    }, indent=2))

    if not all(checks.values()):
        print("MVP ACCOUNTING TEST FAILED")
        sys.exit(1)

    print("MVP ACCOUNTING TEST PASSED")


if __name__ == "__main__":
    main()
