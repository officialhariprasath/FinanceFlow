"""add capital account and transactions

Revision ID: b7f2c8a91d04
Revises: ac6114e4f743
Create Date: 2026-08-18 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7f2c8a91d04"
down_revision: Union[str, Sequence[str], None] = "ac6114e4f743"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "capital_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"],
            ["finance_owners.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("finance_owner_id"),
    )
    op.create_index(
        op.f("ix_capital_accounts_id"),
        "capital_accounts",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_capital_accounts_finance_owner_id"),
        "capital_accounts",
        ["finance_owner_id"],
        unique=True,
    )

    op.create_table(
        "capital_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("capital_account_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.String(length=64), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("balance_after", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["capital_account_id"],
            ["capital_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["finance_owners.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_capital_transactions_capital_account_id"),
        "capital_transactions",
        ["capital_account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_capital_transactions_created_at"),
        "capital_transactions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_capital_transactions_id"),
        "capital_transactions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_capital_transactions_transaction_id"),
        "capital_transactions",
        ["transaction_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_capital_transactions_type"),
        "capital_transactions",
        ["type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_capital_transactions_type"), table_name="capital_transactions")
    op.drop_index(
        op.f("ix_capital_transactions_transaction_id"),
        table_name="capital_transactions",
    )
    op.drop_index(op.f("ix_capital_transactions_id"), table_name="capital_transactions")
    op.drop_index(
        op.f("ix_capital_transactions_created_at"),
        table_name="capital_transactions",
    )
    op.drop_index(
        op.f("ix_capital_transactions_capital_account_id"),
        table_name="capital_transactions",
    )
    op.drop_table("capital_transactions")
    op.drop_index(
        op.f("ix_capital_accounts_finance_owner_id"),
        table_name="capital_accounts",
    )
    op.drop_index(op.f("ix_capital_accounts_id"), table_name="capital_accounts")
    op.drop_table("capital_accounts")
