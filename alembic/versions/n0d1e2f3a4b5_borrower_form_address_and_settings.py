"""Split address fields + borrower form settings JSON (nullable).

Revision ID: n0d1e2f3a4b5
Revises: m9c0d1e2f3a4
Create Date: 2026-11-21
"""

from __future__ import annotations

import time
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import OperationalError

revision: str = "n0d1e2f3a4b5"
down_revision: Union[str, None] = "m9c0d1e2f3a4"
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
    addr_cols = [
        ("addr_line1", "VARCHAR(200)"),
        ("addr_line2", "VARCHAR(200)"),
        ("city", "VARCHAR(100)"),
        ("state", "VARCHAR(100)"),
        ("postal_code", "VARCHAR(20)"),
        ("address_comment", "VARCHAR(500)"),
        ("temp_addr_line1", "VARCHAR(200)"),
        ("temp_addr_line2", "VARCHAR(200)"),
        ("temp_city", "VARCHAR(100)"),
        ("temp_state", "VARCHAR(100)"),
        ("temp_postal_code", "VARCHAR(20)"),
        ("temp_address_comment", "VARCHAR(500)"),
        ("occupation_detail", "VARCHAR(150)"),
    ]
    for name, typ in addr_cols:
        _ddl(f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {name} {typ}")

    # JSON works on Postgres; use JSON type via ADD COLUMN
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS kyc_field_rules JSON"
    )
    _ddl(
        "ALTER TABLE finance_settings "
        "ADD COLUMN IF NOT EXISTS occupation_options JSON"
    )


def downgrade() -> None:
    for name in (
        "addr_line1",
        "addr_line2",
        "city",
        "state",
        "postal_code",
        "address_comment",
        "temp_addr_line1",
        "temp_addr_line2",
        "temp_city",
        "temp_state",
        "temp_postal_code",
        "temp_address_comment",
        "occupation_detail",
    ):
        _ddl(f"ALTER TABLE customers DROP COLUMN IF EXISTS {name}")
    _ddl("ALTER TABLE finance_settings DROP COLUMN IF EXISTS kyc_field_rules")
    _ddl("ALTER TABLE finance_settings DROP COLUMN IF EXISTS occupation_options")
