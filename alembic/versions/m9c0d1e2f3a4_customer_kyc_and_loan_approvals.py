"""Customer KYC fields + loan approval requests (nullable; existing rows untouched).

Revision ID: m9c0d1e2f3a4
Revises: l8b9c0d1e2f3
Create Date: 2026-11-20
"""

from __future__ import annotations

import time
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import OperationalError


revision: str = "m9c0d1e2f3a4"
down_revision: Union[str, None] = "l8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_lock_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "deadlock" in msg or "lock timeout" in msg or "canceling statement" in msg


def _ddl(sql: str, *, attempts: int = 8, sleep_s: float = 2.0) -> None:
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
    # --- customer KYC (all nullable so existing data is undisturbed) ---
    kyc_cols = [
        ("id_type", "VARCHAR(20)"),
        ("id_number", "VARCHAR(50)"),
        ("alternate_phone", "VARCHAR(15)"),
        ("date_of_birth", "DATE"),
        ("gender", "VARCHAR(20)"),
        ("occupation", "VARCHAR(30)"),
        ("business_name", "VARCHAR(150)"),
        ("monthly_income", "NUMERIC(12, 2)"),
        ("area_landmark", "VARCHAR(200)"),
        ("house_ownership", "VARCHAR(20)"),
        ("guarantor_name", "VARCHAR(100)"),
        ("guarantor_phone", "VARCHAR(15)"),
        ("reference1_name", "VARCHAR(100)"),
        ("reference1_phone", "VARCHAR(15)"),
        ("reference2_name", "VARCHAR(100)"),
        ("reference2_phone", "VARCHAR(15)"),
        ("has_other_loans", "BOOLEAN"),
        ("other_loans_emi", "NUMERIC(12, 2)"),
    ]
    for name, typ in kyc_cols:
        _ddl(f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {name} {typ}")

    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS require_loan_approval BOOLEAN NOT NULL DEFAULT FALSE"
    )

    _ddl(
        """
        CREATE TABLE IF NOT EXISTS loan_approval_requests (
            id SERIAL PRIMARY KEY,
            finance_owner_id INTEGER NOT NULL REFERENCES finance_owners(id) ON DELETE CASCADE,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            principal_amount NUMERIC(12, 2) NOT NULL,
            interest_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
            collection_frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
            installment_count INTEGER NOT NULL,
            issue_date DATE NOT NULL,
            due_start_date DATE NOT NULL,
            daily_payment NUMERIC(12, 2),
            daily_principal NUMERIC(12, 2),
            daily_profit NUMERIC(12, 2),
            collection_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
            submitted_by_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
            reviewed_by_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            rejection_reason VARCHAR(500),
            created_loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
            notes VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    _ddl(
        "CREATE INDEX IF NOT EXISTS ix_loan_approval_requests_owner_status "
        "ON loan_approval_requests (finance_owner_id, status)"
    )
    _ddl(
        "CREATE INDEX IF NOT EXISTS ix_loan_approval_requests_customer "
        "ON loan_approval_requests (customer_id)"
    )


def downgrade() -> None:
    _ddl("DROP TABLE IF EXISTS loan_approval_requests")
    _ddl("ALTER TABLE finance_settings DROP COLUMN IF EXISTS require_loan_approval")
    for name in (
        "other_loans_emi",
        "has_other_loans",
        "reference2_phone",
        "reference2_name",
        "reference1_phone",
        "reference1_name",
        "guarantor_phone",
        "guarantor_name",
        "house_ownership",
        "area_landmark",
        "monthly_income",
        "business_name",
        "occupation",
        "gender",
        "date_of_birth",
        "alternate_phone",
        "id_number",
        "id_type",
    ):
        _ddl(f"ALTER TABLE customers DROP COLUMN IF EXISTS {name}")
