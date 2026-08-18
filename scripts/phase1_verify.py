"""Phase 1 verification: capital add, balance, ledger."""

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
EMAIL = "phase1@testfinanceflow.com"
PASSWORD = "Phase1Test!123"


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
    status, _ = request(
        "POST",
        "/finance-owners/register",
        {
            "business_name": "Phase1 Finance",
            "owner_name": "Phase1 Owner",
            "phone": "9999900002",
            "email": EMAIL,
            "password": PASSWORD,
            "address": "Test",
        },
    )
    if status not in (200, 201, 400):
        print("register failed", status)
        sys.exit(1)

    status, token_resp = request(
        "POST",
        "/finance-owners/login",
        f"username={EMAIL}&password={PASSWORD}",
        form=True,
    )
    if status != 200:
        print("login failed", status, token_resp)
        sys.exit(1)

    token = token_resp["access_token"]

    status, summary_before = request("GET", "/capital/summary", token=token)
    if status != 200:
        print("summary before failed", status, summary_before)
        sys.exit(1)

    status, added = request(
        "POST",
        "/capital/add",
        {"amount": "50000.00", "description": "Phase1 initial capital"},
        token=token,
    )
    if status not in (200, 201):
        print("add capital failed", status, added)
        sys.exit(1)

    status, summary = request("GET", "/capital/summary", token=token)
    status2, ledger = request("GET", "/capital/transactions", token=token)

    ok_balance = summary.get("available_capital") == "50000.00"
    ok_added = summary.get("total_capital_added") == "50000.00"
    ok_ledger = (
        status2 == 200
        and len(ledger.get("transactions", [])) >= 1
        and ledger.get("available_capital") == "50000.00"
    )

    print(json.dumps({
        "summary_before": summary_before,
        "added_transaction": {
            "type": added.get("type"),
            "amount": added.get("amount"),
            "balance_after": added.get("balance_after"),
        },
        "summary_after": summary,
        "ledger_count": len(ledger.get("transactions", [])),
        "checks": {
            "balance_50000": ok_balance,
            "total_added_50000": ok_added,
            "ledger_ok": ok_ledger,
        },
    }, indent=2))

    if not (ok_balance and ok_added and ok_ledger):
        print("PHASE 1 CHECKS FAILED")
        sys.exit(1)

    print("ALL PHASE 1 CHECKS PASSED")


if __name__ == "__main__":
    main()
