"""financeflow phases 7-15 extended tables

Revision ID: f8a3b4c5d6e7
Revises: e7f2a3b4c5d6
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a3b4c5d6e7"
down_revision: Union[str, None] = "e7f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column(
            "expense_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("profit_transaction_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expenses_finance_owner_id"), "expenses", ["finance_owner_id"], unique=False)
    op.create_index(op.f("ix_expenses_id"), "expenses", ["id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("actor_type", sa.String(length=20), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_finance_owner_id"), "audit_logs", ["finance_owner_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_finance_owner_id"), "notifications", ["finance_owner_id"], unique=False)
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)

    op.create_table(
        "loan_write_offs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("loan_id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("principal_outstanding", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("amount_recovered", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("principal_loss", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["finance_owner_id"], ["finance_owners.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_loan_write_offs_finance_owner_id"), "loan_write_offs", ["finance_owner_id"], unique=False)
    op.create_index(op.f("ix_loan_write_offs_id"), "loan_write_offs", ["id"], unique=False)
    op.create_index(op.f("ix_loan_write_offs_loan_id"), "loan_write_offs", ["loan_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_loan_write_offs_loan_id"), table_name="loan_write_offs")
    op.drop_index(op.f("ix_loan_write_offs_id"), table_name="loan_write_offs")
    op.drop_index(op.f("ix_loan_write_offs_finance_owner_id"), table_name="loan_write_offs")
    op.drop_table("loan_write_offs")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_finance_owner_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_finance_owner_id"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(op.f("ix_expenses_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_finance_owner_id"), table_name="expenses")
    op.drop_table("expenses")
