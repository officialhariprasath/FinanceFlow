"""Phase 0 verification: register, login, customer, loan, payment, dashboard."""

import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
EMAIL = "phase0@testfinanceflow.com"
PASSWORD = "Phase0Test!123"


def request(method: str, path: str, data=None, token=None, form=False):
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = raw
        return e.code, detail


def main():
    results = []

    status, health = request("GET", "/")
    results.append(("health", status == 200, health))

    status, reg = request(
        "POST",
        "/finance-owners/register",
        {
            "business_name": "Phase0 Finance",
            "owner_name": "Test Owner",
            "phone": "9999900001",
            "email": EMAIL,
            "password": PASSWORD,
            "address": "Test Address",
        },
    )
    ok_reg = status in (200, 201, 400)
    results.append(("register", ok_reg, reg))

    status, token_resp = request(
        "POST",
        "/finance-owners/login",
        f"username={EMAIL}&password={PASSWORD}",
        form=True,
    )
    ok_login = status == 200 and "access_token" in token_resp
    results.append(("login", ok_login, {"status": status}))
    if not ok_login:
        print(json.dumps(results, indent=2))
        sys.exit(1)

    token = token_resp["access_token"]

    status, customer = request(
        "POST",
        "/customers/",
        {"full_name": "Phase0 Borrower", "phone": "8888800001", "address": "Borrower Addr"},
        token=token,
    )
    ok_customer = status in (200, 201)
    results.append(("create_customer", ok_customer, customer))

    issue = date.today()
    due = issue + timedelta(days=100)
    status, loan = request(
        "POST",
        "/loans/",
        {
            "customer_id": customer["id"],
            "principal_amount": "10000.00",
            "interest_method": "RUPEES_PER_100",
            "interest_rate": "2.00",
            "issue_date": issue.isoformat(),
            "due_date": due.isoformat(),
        },
        token=token,
    )
    ok_loan = status in (200, 201)
    results.append(("create_loan", ok_loan, {"id": loan.get("id"), "status": loan.get("status")}))

    status, payment = request(
        "POST",
        "/payments/",
        {
            "loan_id": loan["id"],
            "payment_date": issue.isoformat(),
            "amount_paid": "120.00",
            "payment_mode": "cash",
            "remarks": "Phase0 test payment",
        },
        token=token,
    )
    ok_payment = status in (200, 201)
    results.append(
        (
            "record_payment",
            ok_payment,
            {
                "amount_paid": str(payment.get("amount_paid")),
                "principal_paid": str(payment.get("principal_paid")),
                "interest_paid": str(payment.get("interest_paid")),
            },
        )
    )

    status, dashboard = request("GET", "/dashboard", token=token)
    results.append(("dashboard_summary", status == 200, dashboard))

    status, loans = request("GET", "/loans/", token=token)
    results.append(("list_loans", status == 200 and len(loans) > 0, {"count": len(loans)}))

    failed = [r for r in results if not r[1]]
    print(json.dumps(results, indent=2, default=str))
    if failed:
        print(f"FAILED: {len(failed)} checks")
        sys.exit(1)
    print("ALL PHASE 0 API CHECKS PASSED")


if __name__ == "__main__":
    main()
