"""Persist assessed penalty and paid-on date on installments.

Revision ID: j4d5e6f7a8b9
Revises: i3c4d5e6f7a8
Create Date: 2026-11-09

"""
from datetime import timezone
from decimal import Decimal
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision: str = "j4d5e6f7a8b9"
down_revision: Union[str, None] = "i3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ZERO = Decimal("0.00")


def upgrade() -> None:
    op.add_column(
        "loan_schedules",
        sa.Column(
            "assessed_penalty",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "loan_schedules",
        sa.Column("paid_on", sa.Date(), nullable=True),
    )

    conn = op.get_bind()
    conn.execute(
        text(
            """
            UPDATE loan_schedules
            SET assessed_penalty = paid_penalty
            WHERE COALESCE(paid_penalty, 0) > 0
              AND COALESCE(assessed_penalty, 0) = 0
            """
        )
    )
    _backfill_paid_on(conn)
    op.alter_column("loan_schedules", "assessed_penalty", server_default=None)


def _backfill_paid_on(conn) -> None:
    """Best-effort: apply each payment FIFO onto remaining schedule paid amounts."""
    loans = conn.execute(
        text(
            """
            SELECT DISTINCT loan_id
            FROM payments
            ORDER BY loan_id
            """
        )
    ).fetchall()
    for (loan_id,) in loans:
        schedules = conn.execute(
            text(
                """
                SELECT id, schedule_date, paid_amount, paid_penalty
                FROM loan_schedules
                WHERE loan_id = :loan_id
                ORDER BY schedule_date ASC, id ASC
                """
            ),
            {"loan_id": loan_id},
        ).fetchall()
        remaining = {
            row.id: Decimal(row.paid_amount or 0) + Decimal(row.paid_penalty or 0)
            for row in schedules
        }
        if not any(v > ZERO for v in remaining.values()):
            continue
        paid_on_by_id: dict[int, object] = {}
        payments = conn.execute(
            text(
                """
                SELECT amount_paid, payment_date, created_at
                FROM payments
                WHERE loan_id = :loan_id
                ORDER BY created_at ASC NULLS LAST, id ASC
                """
            ),
            {"loan_id": loan_id},
        ).fetchall()
        for payment in payments:
            leftover = Decimal(payment.amount_paid or 0)
            if leftover <= ZERO:
                continue
            recorded = payment.created_at
            if recorded is not None:
                if getattr(recorded, "tzinfo", None) is None:
                    recorded = recorded.replace(tzinfo=timezone.utc)
                paid_on = recorded.astimezone(timezone.utc).date()
            else:
                paid_on = payment.payment_date
            for row in schedules:
                if leftover <= ZERO:
                    break
                need = remaining.get(row.id, ZERO)
                if need <= ZERO:
                    continue
                applied = need if need <= leftover else leftover
                leftover -= applied
                remaining[row.id] = need - applied
                if row.id not in paid_on_by_id:
                    paid_on_by_id[row.id] = paid_on
        for schedule_id, paid_on in paid_on_by_id.items():
            conn.execute(
                text(
                    """
                    UPDATE loan_schedules
                    SET paid_on = :paid_on
                    WHERE id = :id AND paid_on IS NULL
                    """
                ),
                {"paid_on": paid_on, "id": schedule_id},
            )


def downgrade() -> None:
    op.drop_column("loan_schedules", "paid_on")
    op.drop_column("loan_schedules", "assessed_penalty")
