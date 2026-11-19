"""CIBIL-style score policy: avg-prior multipliers + max/step-up caps.

Revision ID: k7a8b9c0d1e2
Revises: k6f7a8b9c0d1
Create Date: 2026-11-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k7a8b9c0d1e2"
down_revision: Union[str, None] = "k6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_max_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="20000.00",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "score_max_stepup_mult",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="2.0000",
        ),
    )
    # Retune multipliers: suggested = avg(previous loans) × multiplier
    op.execute(
        """
        UPDATE finance_settings
        SET
          score_suggest_mult_thin = 1.0000,
          score_suggest_mult_poor = 1.0000,
          score_suggest_mult_fair = 1.5000,
          score_suggest_mult_good = 2.0000,
          score_suggest_mult_excellent = 2.5000,
          score_baseline_amount = 2000.00,
          score_max_amount = 20000.00,
          score_max_stepup_mult = 2.0000,
          score_band_poor_max = 499,
          score_band_fair_max = 649,
          score_band_good_max = 799
        """
    )


def downgrade() -> None:
    op.drop_column("finance_settings", "score_max_stepup_mult")
    op.drop_column("finance_settings", "score_max_amount")
