"""agent wallet settlement and assignments

Revision ID: e7f2a3b4c5d6
Revises: d5a1b2c3e4f6
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f2a3b4c5d6"
down_revision: Union[str, None] = "d5a1b2c3e4f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("assigned_area", sa.String(length=100), nullable=True),
    )

    op.add_column(
        "payments",
        sa.Column("collected_by_agent_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("payment_reference", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_foreign_key(
        "fk_payments_collected_by_agent",
        "payments",
        "agents",
        ["collected_by_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_payments_collected_by_agent_id"),
        "payments",
        ["collected_by_agent_id"],
        unique=False,
    )

    op.create_table(
        "agent_wallets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("cash_balance", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("upi_balance", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("other_balance", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agent_id"),
    )
    op.create_index(op.f("ix_agent_wallets_agent_id"), "agent_wallets", ["agent_id"])
    op.create_index(
        op.f("ix_agent_wallets_finance_owner_id"),
        "agent_wallets",
        ["finance_owner_id"],
        unique=False,
    )

    op.create_table(
        "agent_settlements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("cash_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("upi_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("other_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("transfer_reference", sa.String(length=100), nullable=True),
        sa.Column("transfer_date", sa.Date(), nullable=True),
        sa.Column("proof_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reconciliation_note", sa.Text(), nullable=True),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_owner_id"], ["finance_owners.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_settlements_agent_id"), "agent_settlements", ["agent_id"]
    )
    op.create_index(
        op.f("ix_agent_settlements_finance_owner_id"),
        "agent_settlements",
        ["finance_owner_id"],
        unique=False,
    )

    op.create_table(
        "agent_ledger_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("credit_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("debit_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("balance_after", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("payment_id", sa.Integer(), nullable=True),
        sa.Column("settlement_id", sa.Integer(), nullable=True),
        sa.Column("payment_reference", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["settlement_id"], ["agent_settlements.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_ledger_entries_agent_id"),
        "agent_ledger_entries",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_ledger_entries_finance_owner_id"),
        "agent_ledger_entries",
        ["finance_owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_ledger_entries_payment_id"),
        "agent_ledger_entries",
        ["payment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_ledger_entries_settlement_id"),
        "agent_ledger_entries",
        ["settlement_id"],
        unique=False,
    )

    op.create_table(
        "agent_customer_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agent_id", "customer_id", name="uq_agent_customer"),
    )
    op.create_index(
        op.f("ix_agent_customer_assignments_agent_id"),
        "agent_customer_assignments",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_customer_assignments_customer_id"),
        "agent_customer_assignments",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_customer_assignments_finance_owner_id"),
        "agent_customer_assignments",
        ["finance_owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("agent_customer_assignments")
    op.drop_table("agent_ledger_entries")
    op.drop_table("agent_settlements")
    op.drop_table("agent_wallets")
    op.drop_index(op.f("ix_payments_collected_by_agent_id"), table_name="payments")
    op.drop_constraint("fk_payments_collected_by_agent", "payments", type_="foreignkey")
    op.drop_column("payments", "is_locked")
    op.drop_column("payments", "payment_reference")
    op.drop_column("payments", "collected_by_agent_id")
    op.drop_column("agents", "assigned_area")
