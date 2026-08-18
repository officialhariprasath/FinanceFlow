"""customer addresses and agents

Revision ID: d5a1b2c3e4f6
Revises: c4e8f1a92b10
Create Date: 2026-08-18 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5a1b2c3e4f6"
down_revision: Union[str, Sequence[str], None] = "c4e8f1a92b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("permanent_address", sa.String(length=300), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("temporary_address", sa.String(length=300), nullable=True),
    )
    op.execute(
        "UPDATE customers SET permanent_address = address WHERE address IS NOT NULL"
    )
    op.drop_column("customers", "address")

    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("finance_owner_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("permissions", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finance_owner_id"],
            ["finance_owners.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_agents_finance_owner_id"), "agents", ["finance_owner_id"], unique=False)
    op.create_index(op.f("ix_agents_id"), "agents", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_agents_id"), table_name="agents")
    op.drop_index(op.f("ix_agents_finance_owner_id"), table_name="agents")
    op.drop_table("agents")
    op.add_column("customers", sa.Column("address", sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE customers SET address = permanent_address WHERE permanent_address IS NOT NULL"
    )
    op.drop_column("customers", "temporary_address")
    op.drop_column("customers", "permanent_address")
