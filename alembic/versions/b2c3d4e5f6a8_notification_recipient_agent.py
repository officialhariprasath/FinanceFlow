"""notification recipient_agent_id

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("recipient_agent_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_notifications_recipient_agent_id"),
        "notifications",
        ["recipient_agent_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_recipient_agent_id"), table_name="notifications")
    op.drop_column("notifications", "recipient_agent_id")
