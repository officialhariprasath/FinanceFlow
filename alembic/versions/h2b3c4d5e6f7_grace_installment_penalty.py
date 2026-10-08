"""Configurable grace installments and fixed penalty per loan frequency.

Revision ID: h2b3c4d5e6f7
Revises: g1a2b3c4d5e6
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h2b3c4d5e6f7"
down_revision: Union[str, None] = "g1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Per-frequency admin defaults (0 = disabled; safe for existing tenants)
    op.add_column(
        "finance_settings",
        sa.Column("daily_grace_installments", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "daily_penalty_per_installment",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column("weekly_grace_installments", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "weekly_penalty_per_installment",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "bi_weekly_grace_installments",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "bi_weekly_penalty_per_installment",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column("monthly_grace_installments", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "monthly_penalty_per_installment",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )

    # Snapshot on each loan at creation (existing loans stay 0 → no silent penalties)
    op.add_column(
        "loans",
        sa.Column("grace_installments", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "loans",
        sa.Column(
            "penalty_per_installment",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )

    # Track penalty payments without mutating expected_amount
    op.add_column(
        "loan_schedules",
        sa.Column("paid_penalty", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("loan_schedules", "paid_penalty")
    op.drop_column("loans", "penalty_per_installment")
    op.drop_column("loans", "grace_installments")
    op.drop_column("finance_settings", "monthly_penalty_per_installment")
    op.drop_column("finance_settings", "monthly_grace_installments")
    op.drop_column("finance_settings", "bi_weekly_penalty_per_installment")
    op.drop_column("finance_settings", "bi_weekly_grace_installments")
    op.drop_column("finance_settings", "weekly_penalty_per_installment")
    op.drop_column("finance_settings", "weekly_grace_installments")
    op.drop_column("finance_settings", "daily_penalty_per_installment")
    op.drop_column("finance_settings", "daily_grace_installments")
