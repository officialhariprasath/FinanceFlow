"""owner cash / settlement account

Revision ID: g1a2b3c4d5e6
Revises: c3d4e5f6a7b9
Create Date: 2026-09-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g1a2b3c4d5e6"
down_revision: Union[str, None] = "c3d4e5f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "owner_cash_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "finance_owner_id",
            sa.Integer(),
            sa.ForeignKey("finance_owners.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("principal_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("profit_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_owner_cash_accounts_finance_owner_id",
        "owner_cash_accounts",
        ["finance_owner_id"],
    )

    op.create_table(
        "owner_cash_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_cash_account_id",
            sa.Integer(),
            sa.ForeignKey("owner_cash_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False, index=True),
        sa.Column("type", sa.String(length=50), nullable=False, index=True),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("principal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("profit_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("principal_balance_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("profit_balance_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, index=True),
    )
    op.create_index(
        "ix_owner_cash_transactions_account_id",
        "owner_cash_transactions",
        ["owner_cash_account_id"],
    )


def downgrade() -> None:
    op.drop_table("owner_cash_transactions")
    op.drop_table("owner_cash_accounts")
