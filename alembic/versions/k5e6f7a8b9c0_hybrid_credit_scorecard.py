"""Hybrid credit scorecard tables and policy columns.

Revision ID: k5e6f7a8b9c0
Revises: j4d5e6f7a8b9
Create Date: 2026-11-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


revision: str = "k5e6f7a8b9c0"
down_revision: Union[str, None] = "j4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "finance_settings",
        sa.Column("score_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "finance_settings",
        sa.Column("score_band_poor_max", sa.Integer(), nullable=False, server_default="579"),
    )
    op.add_column(
        "finance_settings",
        sa.Column("score_band_fair_max", sa.Integer(), nullable=False, server_default="669"),
    )
    op.add_column(
        "finance_settings",
        sa.Column("score_band_good_max", sa.Integer(), nullable=False, server_default="739"),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_suggest_mult_thin",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="0.5000",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_suggest_mult_poor",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="0.5000",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_suggest_mult_fair",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="0.8000",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_suggest_mult_good",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="1.0000",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_suggest_mult_excellent",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="1.2500",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_baseline_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="10000.00",
        ),
    )

    op.add_column("loans", sa.Column("origination_score", sa.Integer(), nullable=True))
    op.add_column(
        "loans",
        sa.Column("origination_band", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "loans",
        sa.Column("origination_suggested_max", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column("loans", sa.Column("origination_reasons_json", JSON, nullable=True))
    op.add_column(
        "loans",
        sa.Column("origination_scorecard_version", sa.String(length=40), nullable=True),
    )

    op.create_table(
        "scorecard_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "finance_owner_id",
            sa.Integer(),
            sa.ForeignKey("finance_owners.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("version", sa.String(length=40), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("definition_json", JSON, nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False, server_default="EXPERT"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "customer_credit_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "finance_owner_id",
            sa.Integer(),
            sa.ForeignKey("finance_owners.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "customer_id",
            sa.Integer(),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("band", sa.String(length=30), nullable=False),
        sa.Column("file_type", sa.String(length=20), nullable=False),
        sa.Column("suggested_max_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reasons_json", JSON, nullable=False),
        sa.Column("features_json", JSON, nullable=False),
        sa.Column("scorecard_version", sa.String(length=40), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "finance_owner_id",
            "customer_id",
            name="uq_customer_credit_scores_owner_customer",
        ),
    )


def downgrade() -> None:
    op.drop_table("customer_credit_scores")
    op.drop_table("scorecard_definitions")
    op.drop_column("loans", "origination_scorecard_version")
    op.drop_column("loans", "origination_reasons_json")
    op.drop_column("loans", "origination_suggested_max")
    op.drop_column("loans", "origination_band")
    op.drop_column("loans", "origination_score")
    op.drop_column("finance_settings", "score_baseline_amount")
    op.drop_column("finance_settings", "score_suggest_mult_excellent")
    op.drop_column("finance_settings", "score_suggest_mult_good")
    op.drop_column("finance_settings", "score_suggest_mult_fair")
    op.drop_column("finance_settings", "score_suggest_mult_poor")
    op.drop_column("finance_settings", "score_suggest_mult_thin")
    op.drop_column("finance_settings", "score_band_good_max")
    op.drop_column("finance_settings", "score_band_fair_max")
    op.drop_column("finance_settings", "score_band_poor_max")
    op.drop_column("finance_settings", "score_enabled")
