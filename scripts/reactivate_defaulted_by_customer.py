"""One-off: reactivate DEFAULTED loans for a customer name (case-insensitive).

Usage (from repo root, with DATABASE_URL set):
  python scripts/reactivate_defaulted_by_customer.py Tamilarasi
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/reactivate_defaulted_by_customer.py <customer_name>")
        return 1

    name = sys.argv[1].strip()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set.")
        return 1

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(database_url)
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT l.id, c.full_name, l.status, l.remaining_principal
                FROM loans l
                JOIN customers c ON c.id = l.customer_id
                WHERE l.status = 'DEFAULTED'
                  AND lower(c.full_name) LIKE lower(:pattern)
                ORDER BY l.id
                """
            ),
            {"pattern": f"%{name}%"},
        ).fetchall()

        if not rows:
            print(f"No DEFAULTED loans found for customer matching '{name}'.")
            return 0

        print(f"Found {len(rows)} defaulted loan(s):")
        for row in rows:
            print(f"  loan #{row.id} | {row.full_name} | principal={row.remaining_principal}")

        result = conn.execute(
            text(
                """
                UPDATE loans l
                SET status = 'ACTIVE'
                FROM customers c
                WHERE c.id = l.customer_id
                  AND l.status = 'DEFAULTED'
                  AND lower(c.full_name) LIKE lower(:pattern)
                """
            ),
            {"pattern": f"%{name}%"},
        )
        print(f"Reactivated {result.rowcount} loan(s) to ACTIVE.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
