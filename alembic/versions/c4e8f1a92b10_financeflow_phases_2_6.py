"""financeflow phases 2-6 schema

Revision ID: c4e8f1a92b10
Revises: b7f2c8a91d04
Create Date: 2026-08-18 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e8f1a92b10"
down_revision: Union[str, Sequence[str], None] = "b7f2c8a91d04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loans", sa.Column("collection_model", sa.String(length=30), nullable=False, server_default="STANDARD"))
    op.add_column("loans", sa.Column("duration_days", sa.Integer(), nullable=True))
    op.add_column("loans", sa.Column("daily_payment", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("loans", sa.Column("daily_principal", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("loans", sa.Column("daily_profit", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("loans", sa.Column("total_expected_profit", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("loans", sa.Column("total_profit_paid", sa.Numeric(precision=12, scale=2), server_default="0", nullable=True))

    op.create_table(
        "profit_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("finance_owner_id"),
    )
    op.create_index(op.f("ix_profit_accounts_finance_owner_id"), "profit_accounts", ["finance_owner_id"], unique=True)
    op.create_index(op.f("ix_profit_accounts_id"), "profit_accounts", ["id"], unique=False)

    op.create_table(
        "profit_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("profit_account_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["created_by"], ["finance_owners.id"]),
        sa.ForeignKeyConstraint(["profit_account_id"], ["profit_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_profit_transactions_created_at"), "profit_transactions", ["created_at"], unique=False)
    op.create_index(op.f("ix_profit_transactions_id"), "profit_transactions", ["id"], unique=False)
    op.create_index(op.f("ix_profit_transactions_profit_account_id"), "profit_transactions", ["profit_account_id"], unique=False)
    op.create_index(op.f("ix_profit_transactions_transaction_id"), "profit_transactions", ["transaction_id"], unique=False)
    op.create_index(op.f("ix_profit_transactions_type"), "profit_transactions", ["type"], unique=False)

    op.create_table(
        "loan_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("loan_id", sa.Integer(), nullable=False),
        sa.Column("schedule_date", sa.Date(), nullable=False),
        sa.Column("expected_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("expected_principal", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("expected_profit", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("paid_principal", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("paid_profit", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_loan_schedules_id"), "loan_schedules", ["id"], unique=False)
    op.create_index(op.f("ix_loan_schedules_loan_id"), "loan_schedules", ["loan_id"], unique=False)
    op.create_index(op.f("ix_loan_schedules_schedule_date"), "loan_schedules", ["schedule_date"], unique=False)

    op.create_table(
        "payment_allocations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_id", sa.Integer(), nullable=False),
        sa.Column("loan_id", sa.Integer(), nullable=False),
        sa.Column("principal_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("profit_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("late_fee_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("other_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_id"),
    )
    op.create_index(op.f("ix_payment_allocations_id"), "payment_allocations", ["id"], unique=False)
    op.create_index(op.f("ix_payment_allocations_loan_id"), "payment_allocations", ["loan_id"], unique=False)
    op.create_index(op.f("ix_payment_allocations_payment_id"), "payment_allocations", ["payment_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_allocations_payment_id"), table_name="payment_allocations")
    op.drop_index(op.f("ix_payment_allocations_loan_id"), table_name="payment_allocations")
    op.drop_index(op.f("ix_payment_allocations_id"), table_name="payment_allocations")
    op.drop_table("payment_allocations")
    op.drop_index(op.f("ix_loan_schedules_schedule_date"), table_name="loan_schedules")
    op.drop_index(op.f("ix_loan_schedules_loan_id"), table_name="loan_schedules")
    op.drop_index(op.f("ix_loan_schedules_id"), table_name="loan_schedules")
    op.drop_table("loan_schedules")
    op.drop_index(op.f("ix_profit_transactions_type"), table_name="profit_transactions")
    op.drop_index(op.f("ix_profit_transactions_transaction_id"), table_name="profit_transactions")
    op.drop_index(op.f("ix_profit_transactions_profit_account_id"), table_name="profit_transactions")
    op.drop_index(op.f("ix_profit_transactions_id"), table_name="profit_transactions")
    op.drop_index(op.f("ix_profit_transactions_created_at"), table_name="profit_transactions")
    op.drop_table("profit_transactions")
    op.drop_index(op.f("ix_profit_accounts_id"), table_name="profit_accounts")
    op.drop_index(op.f("ix_profit_accounts_finance_owner_id"), table_name="profit_accounts")
    op.drop_table("profit_accounts")
    op.drop_column("loans", "total_profit_paid")
    op.drop_column("loans", "total_expected_profit")
    op.drop_column("loans", "daily_profit")
    op.drop_column("loans", "daily_principal")
    op.drop_column("loans", "daily_payment")
    op.drop_column("loans", "duration_days")
    op.drop_column("loans", "collection_model")
