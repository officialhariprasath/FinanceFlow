"""Extended API tests for FinanceFlow (settlements phase 1, notifications, reconciliation)."""

import json
import sys
import urllib.error
import urllib.request
from datetime import date

BASE = "http://127.0.0.1:8000"
OWNER_EMAIL = "owner@financeflow.demo"
OWNER_PASSWORD = "Owner@12345"
AGENT_EMAIL = "kumar@financeflow.demo"
AGENT_PASSWORD = "Agent@12345"

FAILURES = []
PASSES = []


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


def check(name, condition, detail=""):
    if condition:
        PASSES.append(name)
        print(f"  PASS: {name}")
        return True
    FAILURES.append(name)
    print(f"  FAIL: {name} — {detail}")
    return False


def login(email, password, agent=False):
    path = "/agents/login" if agent else "/finance-owners/login"
    status, resp = request(
        "POST", path, f"username={email}&password={password}", form=True
    )
    if status != 200:
        raise RuntimeError(f"Login failed: {status} {resp}")
    return resp["access_token"]


def unpaid_loan_and_amount(loans, collections_items):
    paid_loan_ids = {i.get("loan_id") for i in collections_items if i.get("is_paid")}
    for loan in loans:
        if loan["id"] not in paid_loan_ids and loan.get("status") == "ACTIVE":
            return loan["id"], "120.00"
    for item in collections_items:
        if not item.get("is_paid"):
            return item.get("loan_id"), str(item.get("expected_amount", "120.00"))
    return None, None


def main():
    print("=== FinanceFlow Extended API Test ===\n")
    today = date.today().isoformat()

    owner = login(OWNER_EMAIL, OWNER_PASSWORD)
    agent = login(AGENT_EMAIL, AGENT_PASSWORD, agent=True)

    # Notifications
    s, n_owner = request("GET", "/notifications/count", token=owner)
    check("Owner notification count", s == 200 and "unread_count" in n_owner, n_owner)

    s, n_agent = request("GET", "/notifications/count", token=agent)
    check("Agent notification count", s == 200, n_agent)

    s, notes_owner = request("GET", "/notifications", token=owner)
    check("Owner notifications list", s == 200, notes_owner)

    s, notes_agent = request("GET", "/notifications", token=agent)
    check("Agent notifications list", s == 200, notes_agent)

    # Reconciliation fields
    s, rec = request("GET", "/ledger/reconciliation", token=owner)
    check("Reconciliation has pending fields", s == 200 and "pending_settlement_count" in rec, rec)

    # Dashboard settlement fields
    s, dash = request("GET", "/dashboard/financeflow", token=owner)
    check(
        "Dashboard unsettled + pending fields",
        s == 200 and "unsettled_with_agents" in dash and "pending_settlement_count" in dash,
        dash,
    )

    # Wallet pending fields
    s, wallet = request("GET", "/agent-wallet/me", token=agent)
    check(
        "Wallet has pending settlement fields",
        s == 200 and "has_pending_settlement" in wallet,
        wallet,
    )

    # Settlement validation: UPI without reference
    s, bad = request(
        "POST",
        "/agent-settlements/",
        {
            "cash_amount": "0",
            "upi_amount": "10.00",
            "other_amount": "0",
            "delivery_method": "UPI",
            "delivery_cash_amount": "0",
            "delivery_upi_amount": "10.00",
            "delivery_other_amount": "0",
        },
        token=agent,
    )
    check("UPI delivery requires reference", s == 400, bad)

    # If wallet has balance, try cross-channel settlement flow
    s, w = request("GET", "/agent-wallet/me", token=agent)
    cash = float(w.get("cash_balance", 0)) if s == 200 else 0
    pending = w.get("has_pending_settlement") if s == 200 else False

    if cash >= 10 and not pending:
        s, settle = request(
            "POST",
            "/agent-settlements/",
            {
                "cash_amount": "10.00",
                "upi_amount": "0",
                "other_amount": "0",
                "delivery_method": "UPI",
                "delivery_cash_amount": "0",
                "delivery_upi_amount": "10.00",
                "delivery_other_amount": "0",
                "transfer_reference": "TEST-UPI-REF",
                "transfer_date": today,
            },
            token=agent,
        )
        check("Cross-channel settlement submit", s in (200, 201), settle)
        sid = settle.get("id") if s in (200, 201) else None

        if sid:
            s, dup = request(
                "POST",
                "/agent-settlements/",
                {
                    "cash_amount": "5.00",
                    "upi_amount": "0",
                    "other_amount": "0",
                    "delivery_method": "CASH",
                    "delivery_cash_amount": "5.00",
                    "delivery_upi_amount": "0",
                    "delivery_other_amount": "0",
                },
                token=agent,
            )
            check("Block duplicate pending settlement", s == 400, dup)

            s, pending_list = request("GET", "/agent-settlements/pending", token=owner)
            check("Owner pending includes settlement", s == 200 and any(p["id"] == sid for p in pending_list), pending_list)

            s, approved = request("POST", f"/agent-settlements/{sid}/approve", token=owner)
            check("Approve cross-channel settlement", s == 200, approved)

            s, w2 = request("GET", "/agent-wallet/me", token=agent)
            if s == 200:
                check("Cash reduced after approve", float(w2.get("cash_balance", 0)) < cash, w2)

            s, notes = request("GET", "/notifications", token=agent)
            check(
                "Agent got approval notification",
                s == 200 and any("approved" in n.get("title", "").lower() for n in notes),
                notes[:2],
            )
    else:
        print(f"  SKIP: cross-channel flow (cash={cash}, pending={pending})")

    # Collect on unpaid loan if possible
    s, loans = request("GET", "/loans/", token=owner)
    s2, coll = request("GET", "/collections/today", token=agent)
    loan_id, amount = unpaid_loan_and_amount(loans if s == 200 else [], coll.get("items", []) if s2 == 200 else [])

    if loan_id:
        s, pay = request(
            "POST",
            "/payments/",
            {
                "loan_id": loan_id,
                "payment_date": today,
                "amount_paid": amount,
                "payment_mode": "Cash",
                "remarks": "Extended test collection",
            },
            token=agent,
        )
        check("Agent collection on unpaid loan", s in (200, 201), pay)
        if s in (200, 201):
            s, notes = request("GET", "/notifications", token=owner)
            check(
                "Owner collection notification",
                s == 200 and any("collection" in n.get("title", "").lower() for n in notes),
                notes[:3],
            )
    else:
        print("  SKIP: no unpaid loan for collection test")

    # Audit logs
    s, logs = request("GET", "/audit/logs", token=owner)
    check("Audit logs accessible", s == 200 and len(logs) > 0, f"count={len(logs) if s==200 else 0}")

    # Extended endpoints smoke
    for path, name in [
        ("/expenses", "Expenses list"),
        ("/ledger/business", "Business ledger"),
        ("/profit/net-summary", "Net profit"),
        ("/defaults/overdue", "Overdue loans"),
        ("/reports/summary", "Reports summary"),
    ]:
        s, _ = request("GET", path, token=owner)
        check(name, s == 200)

    print(f"\n=== Summary: {len(PASSES)} passed, {len(FAILURES)} failed ===")
    if FAILURES:
        print("FAILED:", ", ".join(FAILURES))
        sys.exit(1)
    print("All extended tests passed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Error:", e)
        sys.exit(1)
