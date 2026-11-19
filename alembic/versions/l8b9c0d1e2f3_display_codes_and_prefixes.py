"""Add customer/loan display codes and configurable prefixes.

Revision ID: l8b9c0d1e2f3
Revises: k7a8b9c0d1e2
Create Date: 2026-11-19

Idempotent + deadlock-tolerant for Render: ALTER TABLE runs in
autocommit blocks with retries so a live web process holding
AccessShareLock does not permanently fail the deploy.
"""

from __future__ import annotations

import time
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import OperationalError


revision: str = "l8b9c0d1e2f3"
down_revision: Union[str, None] = "k7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _format_code(prefix: str, sequence: int, padding: int) -> str:
    width = max(padding, len(str(sequence)))
    return f"{prefix}{sequence:0{width}d}"


def _inspector():
    return sa.inspect(op.get_bind())


def _has_column(table: str, column: str) -> bool:
    return any(col["name"] == column for col in _inspector().get_columns(table))


def _has_unique(table: str, name: str) -> bool:
    return any(uc.get("name") == name for uc in _inspector().get_unique_constraints(table))


def _has_index(table: str, name: str) -> bool:
    return any(ix.get("name") == name for ix in _inspector().get_indexes(table))


def _is_lock_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "deadlock" in msg
        or "lock timeout" in msg
        or "canceling statement due to lock timeout" in msg
    )


def _ddl(sql: str, *, attempts: int = 10, sleep_s: float = 3.0) -> None:
    """
    Run DDL outside the migration transaction (autocommit) and retry
    on deadlock / lock timeout. Each failed attempt is its own aborted
    statement, so the next retry can succeed.
    """
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with op.get_context().autocommit_block():
                conn = op.get_bind()
                conn.execute(sa.text("SET lock_timeout = '20s'"))
                conn.execute(sa.text(sql))
            return
        except OperationalError as exc:
            last_exc = exc
            if not _is_lock_error(exc) or attempt >= attempts:
                raise
            time.sleep(sleep_s * attempt)
    assert last_exc is not None
    raise last_exc


def upgrade() -> None:
    # --- schema (autocommit + retry) ---
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS customer_code_prefix VARCHAR(12) NOT NULL DEFAULT 'VMFC'"
    )
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS loan_code_prefix VARCHAR(12) NOT NULL DEFAULT 'VMFL'"
    )
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS code_number_padding INTEGER NOT NULL DEFAULT 4"
    )
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS customer_code_next INTEGER NOT NULL DEFAULT 1"
    )
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS loan_code_next INTEGER NOT NULL DEFAULT 1"
    )
    _ddl("ALTER TABLE customers ADD COLUMN IF NOT EXISTS display_code VARCHAR(32)")
    _ddl("ALTER TABLE loans ADD COLUMN IF NOT EXISTS display_code VARCHAR(32)")

    # --- backfill (normal transaction) ---
    conn = op.get_bind()

    owners = conn.execute(
        sa.text(
            """
            SELECT finance_owner_id FROM finance_settings
            UNION
            SELECT DISTINCT finance_owner_id FROM customers
            UNION
            SELECT DISTINCT finance_owner_id FROM loans
            """
        )
    ).fetchall()
    owner_ids = sorted({row[0] for row in owners})

    for owner_id in owner_ids:
        settings = conn.execute(
            sa.text(
                """
                SELECT customer_code_prefix, loan_code_prefix, code_number_padding
                FROM finance_settings
                WHERE finance_owner_id = :oid
                """
            ),
            {"oid": owner_id},
        ).fetchone()
        if settings is None:
            cust_prefix, loan_prefix, padding = "VMFC", "VMFL", 4
        else:
            cust_prefix, loan_prefix, padding = settings[0], settings[1], int(settings[2])

        existing_cust = int(
            conn.execute(
                sa.text(
                    """
                    SELECT COUNT(*) FROM customers
                    WHERE finance_owner_id = :oid AND display_code IS NOT NULL
                    """
                ),
                {"oid": owner_id},
            ).scalar()
            or 0
        )
        pending_cust = conn.execute(
            sa.text(
                """
                SELECT id FROM customers
                WHERE finance_owner_id = :oid AND display_code IS NULL
                ORDER BY id ASC
                """
            ),
            {"oid": owner_id},
        ).fetchall()
        for offset, (cid,) in enumerate(pending_cust):
            code = _format_code(cust_prefix, existing_cust + 1 + offset, padding)
            conn.execute(
                sa.text(
                    "UPDATE customers SET display_code = :code "
                    "WHERE id = :cid AND display_code IS NULL"
                ),
                {"code": code, "cid": cid},
            )

        existing_loan = int(
            conn.execute(
                sa.text(
                    """
                    SELECT COUNT(*) FROM loans
                    WHERE finance_owner_id = :oid AND display_code IS NOT NULL
                    """
                ),
                {"oid": owner_id},
            ).scalar()
            or 0
        )
        pending_loan = conn.execute(
            sa.text(
                """
                SELECT id FROM loans
                WHERE finance_owner_id = :oid AND display_code IS NULL
                ORDER BY id ASC
                """
            ),
            {"oid": owner_id},
        ).fetchall()
        for offset, (lid,) in enumerate(pending_loan):
            code = _format_code(loan_prefix, existing_loan + 1 + offset, padding)
            conn.execute(
                sa.text(
                    "UPDATE loans SET display_code = :code "
                    "WHERE id = :lid AND display_code IS NULL"
                ),
                {"code": code, "lid": lid},
            )

        total_cust = int(
            conn.execute(
                sa.text("SELECT COUNT(*) FROM customers WHERE finance_owner_id = :oid"),
                {"oid": owner_id},
            ).scalar()
            or 0
        )
        total_loan = int(
            conn.execute(
                sa.text("SELECT COUNT(*) FROM loans WHERE finance_owner_id = :oid"),
                {"oid": owner_id},
            ).scalar()
            or 0
        )
        conn.execute(
            sa.text(
                """
                UPDATE finance_settings
                SET customer_code_next = GREATEST(customer_code_next, :cn),
                    loan_code_next = GREATEST(loan_code_next, :ln)
                WHERE finance_owner_id = :oid
                """
            ),
            {"cn": total_cust + 1, "ln": total_loan + 1, "oid": owner_id},
        )

    conn.execute(
        sa.text(
            """
            UPDATE customers
            SET display_code = 'VMFC' || LPAD(id::text, 4, '0')
            WHERE display_code IS NULL
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE loans
            SET display_code = 'VMFL' || LPAD(id::text, 4, '0')
            WHERE display_code IS NULL
            """
        )
    )

    # --- tighten + indexes (autocommit + retry) ---
    _ddl("ALTER TABLE customers ALTER COLUMN display_code SET NOT NULL")
    _ddl("ALTER TABLE loans ALTER COLUMN display_code SET NOT NULL")

    if not _has_unique("customers", "uq_customers_owner_display_code"):
        _ddl(
            "ALTER TABLE customers ADD CONSTRAINT uq_customers_owner_display_code "
            "UNIQUE (finance_owner_id, display_code)"
        )
    if not _has_unique("loans", "uq_loans_owner_display_code"):
        _ddl(
            "ALTER TABLE loans ADD CONSTRAINT uq_loans_owner_display_code "
            "UNIQUE (finance_owner_id, display_code)"
        )
    if not _has_index("customers", "ix_customers_display_code"):
        _ddl(
            "CREATE INDEX IF NOT EXISTS ix_customers_display_code ON customers (display_code)"
        )
    if not _has_index("loans", "ix_loans_display_code"):
        _ddl(
            "CREATE INDEX IF NOT EXISTS ix_loans_display_code ON loans (display_code)"
        )


def downgrade() -> None:
    if _has_index("loans", "ix_loans_display_code"):
        op.drop_index("ix_loans_display_code", table_name="loans")
    if _has_index("customers", "ix_customers_display_code"):
        op.drop_index("ix_customers_display_code", table_name="customers")
    if _has_unique("loans", "uq_loans_owner_display_code"):
        op.drop_constraint("uq_loans_owner_display_code", "loans", type_="unique")
    if _has_unique("customers", "uq_customers_owner_display_code"):
        op.drop_constraint("uq_customers_owner_display_code", "customers", type_="unique")
    if _has_column("loans", "display_code"):
        op.drop_column("loans", "display_code")
    if _has_column("customers", "display_code"):
        op.drop_column("customers", "display_code")
    for col in (
        "loan_code_next",
        "customer_code_next",
        "code_number_padding",
        "loan_code_prefix",
        "customer_code_prefix",
    ):
        if _has_column("finance_settings", col):
            op.drop_column("finance_settings", col)
