"""Retune credit score policy defaults for 0–1000 scale and ₹2k baseline.

Revision ID: k6f7a8b9c0d1
Revises: k5e6f7a8b9c0
Create Date: 2026-11-19
"""

from typing import Sequence, Union

from alembic import op


revision: str = "k6f7a8b9c0d1"
down_revision: Union[str, None] = "k5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safe even if prior migration just landed — updates all owners to 1000-scale policy.
    op.execute(
        """
        UPDATE finance_settings
        SET
          score_band_poor_max = 499,
          score_band_fair_max = 649,
          score_band_good_max = 799,
          score_suggest_mult_thin = 1.0000,
          score_suggest_mult_poor = 1.5000,
          score_suggest_mult_fair = 2.5000,
          score_suggest_mult_good = 5.0000,
          score_suggest_mult_excellent = 10.0000,
          score_baseline_amount = 2000.00,
          score_enabled = true
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE finance_settings
        SET
          score_band_poor_max = 579,
          score_band_fair_max = 669,
          score_band_good_max = 739,
          score_suggest_mult_thin = 0.5000,
          score_suggest_mult_poor = 0.5000,
          score_suggest_mult_fair = 0.8000,
          score_suggest_mult_good = 1.0000,
          score_suggest_mult_excellent = 1.2500,
          score_baseline_amount = 10000.00
        """
    )
