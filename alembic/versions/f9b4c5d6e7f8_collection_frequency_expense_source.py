"""loan collection frequency and expense funding source

Revision ID: f9b4c5d6e7f8
Revises: f8a3b4c5d6e7
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9b4c5d6e7f8"
down_revision: Union[str, None] = "f8a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "loans",
        sa.Column("collection_frequency", sa.String(length=20), nullable=False, server_default="DAILY"),
    )
    op.add_column("loans", sa.Column("installment_count", sa.Integer(), nullable=True))
    op.add_column("loans", sa.Column("due_start_date", sa.Date(), nullable=True))

    op.execute(
        """
        UPDATE loans
        SET installment_count = duration_days,
            due_start_date = issue_date
        WHERE collection_model = 'DAILY_COLLECTION'
        """
    )

    op.add_column(
        "expenses",
        sa.Column("funding_source", sa.String(length=20), nullable=False, server_default="PROFIT"),
    )
    op.add_column("expenses", sa.Column("capital_transaction_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("expenses", "capital_transaction_id")
    op.drop_column("expenses", "funding_source")
    op.drop_column("loans", "due_start_date")
    op.drop_column("loans", "installment_count")
    op.drop_column("loans", "collection_frequency")
