"""Full end-to-end API test: owner, agent wallet, settlements, permissions."""

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
        print(f"  PASS: {name}")
        return True
    FAILURES.append(name)
    print(f"  FAIL: {name} — {detail}")
    return False


def login(email, password, agent=False):
    path = "/agents/login" if agent else "/finance-owners/login"
    status, resp = request(
        "POST",
        path,
        f"username={email}&password={password}",
        form=True,
    )
    if status != 200:
        raise RuntimeError(f"Login failed: {status} {resp}")
    return resp["access_token"]


def main():
    print("=== FinanceFlow E2E Test ===\n")

    owner_token = login(OWNER_EMAIL, OWNER_PASSWORD)
    agent_token = login(AGENT_EMAIL, AGENT_PASSWORD, agent=True)

    # Session
    s, session = request("GET", "/agents/session", token=owner_token)
    check("Owner session", s == 200 and session.get("is_owner"), session)

    s, agent_session = request("GET", "/agents/session", token=agent_token)
    check(
        "Agent session",
        s == 200 and not agent_session.get("is_owner"),
        agent_session,
    )
    check(
        "Agent has settlements permission",
        "settlements" in agent_session.get("permissions", []),
        agent_session.get("permissions"),
    )

    # Capital & dashboard
    s, cap = request("GET", "/capital/summary", token=owner_token)
    check("Capital summary", s == 200, cap)
    s, dash = request("GET", "/dashboard/financeflow", token=owner_token)
    check("FinanceFlow dashboard", s == 200, dash)

    # Loans & customers
    s, loans = request("GET", "/loans/", token=owner_token)
    check("List loans", s == 200 and len(loans) >= 3, loans)
    s, customers = request("GET", "/customers/", token=owner_token)
    check("List customers", s == 200 and len(customers) >= 3, customers)

    # Agent collections (assigned only)
    s, collections = request("GET", "/collections/today", token=agent_token)
    check("Agent today collections", s == 200, collections)
    if s == 200:
        check(
            "Agent sees assigned borrowers only (<=3 items if 4 loans total)",
            len(collections.get("items", [])) <= 3,
            f"items={len(collections.get('items', []))}",
        )

    # Owner sees all collections
    s, owner_coll = request("GET", "/collections/today", token=owner_token)
    if s == 200:
        check(
            "Owner sees all collection items",
            len(owner_coll.get("items", [])) >= len(collections.get("items", [])),
            f"owner={len(owner_coll.get('items', []))} agent={len(collections.get('items', []))}",
        )

    loan_id = loans[0]["id"] if loans else None
    today = date.today().isoformat()

    # Agent collect cash
    s, pay_cash = request(
        "POST",
        "/payments/",
        {
            "loan_id": loan_id,
            "payment_date": today,
            "amount_paid": "120.00",
            "payment_mode": "Cash",
            "remarks": "Morning collection",
        },
        token=agent_token,
    )
    check("Agent cash collection", s in (200, 201), pay_cash)
    cash_payment_id = pay_cash.get("id") if s in (200, 201) else None

    # Agent collect UPI on second loan
    loan_id_2 = loans[1]["id"] if len(loans) > 1 else loan_id
    s, pay_upi = request(
        "POST",
        "/payments/",
        {
            "loan_id": loan_id_2,
            "payment_date": today,
            "amount_paid": "120.00",
            "payment_mode": "UPI",
            "payment_reference": "UPI987654321",
            "remarks": "UPI collection",
        },
        token=agent_token,
    )
    check("Agent UPI collection", s in (200, 201), pay_upi)

    # Wallet balances
    s, wallet = request("GET", "/agent-wallet/me", token=agent_token)
    check("Agent wallet", s == 200, wallet)
    if s == 200:
        total = float(wallet.get("total_balance", 0))
        check("Wallet total >= 240 after 2 collections", total >= 240, wallet)

    s, ledger = request("GET", "/agent-wallet/me/ledger", token=agent_token)
    check("Agent ledger entries", s == 200 and len(ledger) >= 2, ledger)

    s, agent_dash = request("GET", "/agent-wallet/me/dashboard", token=agent_token)
    check("Agent dashboard", s == 200, agent_dash)

    # Agent cannot access owner settlements list
    s, forbidden = request("GET", "/agent-settlements/pending", token=agent_token)
    check("Agent blocked from pending settlements", s == 403, forbidden)

    # Agent cannot add capital
    s, cap_fail = request(
        "POST",
        "/capital/add",
        {"amount": "1000.00", "description": "hack"},
        token=agent_token,
    )
    check("Agent blocked from capital add", s == 403, cap_fail)

    # Agent cannot delete payment
    if cash_payment_id:
        s, del_fail = request(
            "DELETE",
            f"/payments/{cash_payment_id}",
            token=agent_token,
        )
        check("Agent blocked from delete payment", s in (403, 401), del_fail)

    # Submit settlement (cash portion after correct channel mapping)
    s, wallet_before_settle = request("GET", "/agent-wallet/me", token=agent_token)
    cash_bal = float(wallet_before_settle.get("cash_balance", 0)) if s == 200 else 0
    upi_bal = float(wallet_before_settle.get("upi_balance", 0)) if s == 200 else 0
    other_bal = float(wallet_before_settle.get("other_balance", 0)) if s == 200 else 0

    s, settlement = request(
        "POST",
        "/agent-settlements/",
        {
            "cash_amount": f"{cash_bal:.2f}",
            "upi_amount": f"{upi_bal:.2f}",
            "other_amount": f"{other_bal:.2f}",
            "transfer_reference": "SETTLE-001",
            "transfer_date": today,
            "proof_notes": "End of day handover",
        },
        token=agent_token,
    )
    check("Agent submit settlement", s in (200, 201), settlement)
    settlement_id = settlement.get("id") if s in (200, 201) else None

    s, pending = request("GET", "/agent-settlements/pending", token=owner_token)
    check("Owner sees pending settlement", s == 200 and len(pending) >= 1, pending)

    s, agent_wallets = request("GET", "/agent-wallet/agents", token=owner_token)
    check("Owner agent wallets list", s == 200 and len(agent_wallets) >= 1, agent_wallets)

    if settlement_id:
        s, approved = request(
            "POST",
            f"/agent-settlements/{settlement_id}/approve",
            token=owner_token,
        )
        check("Owner approve settlement", s == 200, approved)

        s, wallet_after = request("GET", "/agent-wallet/me", token=agent_token)
        if s == 200:
            total_after = float(wallet_after.get("total_balance", 0))
            check(
                "Wallet reduced after settlement",
                total_after < float(wallet.get("total_balance", 0)),
                wallet_after,
            )

    # Owner direct payment on last loan (not yet collected by agent in this test)
    loan_id_owner = loans[-1]["id"] if loans else loan_id
    s, owner_pay = request(
        "POST",
        "/payments/",
        {
            "loan_id": loan_id_owner,
            "payment_date": today,
            "amount_paid": "120.00",
            "payment_mode": "Cash",
        },
        token=owner_token,
    )
    check("Owner direct payment", s in (200, 201), owner_pay)
    if s in (200, 201):
        check(
            "Owner payment has no agent collector",
            owner_pay.get("collected_by_agent_id") is None,
            owner_pay,
        )

    # Agents CRUD list
    s, agents = request("GET", "/agents/", token=owner_token)
    check("List agents", s == 200 and len(agents) >= 1, agents)

    print("\n=== Summary ===")
    if FAILURES:
        print(f"FAILED ({len(FAILURES)}):", ", ".join(FAILURES))
        sys.exit(1)
    print("All tests passed.")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print("API not reachable:", e)
        sys.exit(1)
    except Exception as e:
        print("Test error:", e)
        sys.exit(1)
