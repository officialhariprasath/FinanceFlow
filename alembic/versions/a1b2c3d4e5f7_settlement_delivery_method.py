"""agent settlement delivery method fields

Revision ID: a1b2c3d4e5f7
Revises: f9b4c5d6e7f8
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f9b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_settlements",
        sa.Column("delivery_method", sa.String(length=20), nullable=False, server_default="CASH"),
    )
    op.add_column(
        "agent_settlements",
        sa.Column("delivery_cash_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"),
    )
    op.add_column(
        "agent_settlements",
        sa.Column("delivery_upi_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"),
    )
    op.add_column(
        "agent_settlements",
        sa.Column("delivery_other_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"),
    )
    op.execute(
        """
        UPDATE agent_settlements
        SET delivery_cash_amount = cash_amount,
            delivery_upi_amount = upi_amount,
            delivery_other_amount = other_amount,
            delivery_method = CASE
                WHEN cash_amount > 0 AND upi_amount = 0 AND other_amount = 0 THEN 'CASH'
                WHEN upi_amount > 0 AND cash_amount = 0 AND other_amount = 0 THEN 'UPI'
                WHEN other_amount > 0 AND cash_amount = 0 AND upi_amount = 0 THEN 'BANK'
                ELSE 'MIXED'
            END
        """
    )


def downgrade() -> None:
    op.drop_column("agent_settlements", "delivery_other_amount")
    op.drop_column("agent_settlements", "delivery_upi_amount")
    op.drop_column("agent_settlements", "delivery_cash_amount")
    op.drop_column("agent_settlements", "delivery_method")
