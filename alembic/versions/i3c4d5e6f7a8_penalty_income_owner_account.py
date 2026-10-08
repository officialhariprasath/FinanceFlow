"""Owner Account penalty balance + settlement income split.

Revision ID: i3c4d5e6f7a8
Revises: h2b3c4d5e6f7
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i3c4d5e6f7a8"
down_revision: Union[str, None] = "h2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "owner_cash_accounts",
        sa.Column(
            "penalty_balance",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "owner_cash_transactions",
        sa.Column(
            "penalty_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "owner_cash_transactions",
        sa.Column(
            "penalty_balance_after",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("owner_cash_transactions", "penalty_balance_after")
    op.drop_column("owner_cash_transactions", "penalty_amount")
    op.drop_column("owner_cash_accounts", "penalty_balance")
