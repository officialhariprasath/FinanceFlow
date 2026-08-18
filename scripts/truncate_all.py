"""Truncate all application tables for a clean re-seed without docker volume wipe."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from backend.app.database.session import SessionLocal


TABLES = [
    "agent_ledger_entries",
    "agent_settlements",
    "agent_customer_assignments",
    "agent_wallets",
    "payment_allocations",
    "payments",
    "loan_schedules",
    "loan_renewals",
    "profit_transactions",
    "capital_transactions",
    "loans",
    "customers",
    "agents",
    "profit_accounts",
    "capital_accounts",
    "finance_settings",
    "finance_owners",
]


def main():
    db = SessionLocal()
    try:
        for table in TABLES:
            db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        db.commit()
        print("All tables truncated.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
