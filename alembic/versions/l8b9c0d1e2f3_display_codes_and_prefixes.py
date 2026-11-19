"""Add customer/loan display codes and configurable prefixes.

Revision ID: l8b9c0d1e2f3
Revises: k7a8b9c0d1e2
Create Date: 2026-11-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l8b9c0d1e2f3"
down_revision: Union[str, None] = "k7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _format_code(prefix: str, sequence: int, padding: int) -> str:
    width = max(padding, len(str(sequence)))
    return f"{prefix}{sequence:0{width}d}"


def upgrade() -> None:
    op.add_column(
        "finance_settings",
        sa.Column(
            "customer_code_prefix",
            sa.String(12),
            nullable=False,
            server_default="VMFC",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "loan_code_prefix",
            sa.String(12),
            nullable=False,
            server_default="VMFL",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "code_number_padding",
            sa.Integer(),
            nullable=False,
            server_default="4",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "customer_code_next",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "finance_settings",
        sa.Column(
            "loan_code_next",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )

    op.add_column(
        "customers",
        sa.Column("display_code", sa.String(32), nullable=True),
    )
    op.add_column(
        "loans",
        sa.Column("display_code", sa.String(32), nullable=True),
    )

    conn = op.get_bind()

    owners = conn.execute(
        sa.text("SELECT DISTINCT finance_owner_id FROM customers")
    ).fetchall()
    owner_ids = {row[0] for row in owners}
    loan_owners = conn.execute(
        sa.text("SELECT DISTINCT finance_owner_id FROM loans")
    ).fetchall()
    owner_ids |= {row[0] for row in loan_owners}
    settings_owners = conn.execute(
        sa.text("SELECT finance_owner_id FROM finance_settings")
    ).fetchall()
    owner_ids |= {row[0] for row in settings_owners}

    for owner_id in sorted(owner_ids):
        settings = conn.execute(
            sa.text(
                """
                SELECT customer_code_prefix, loan_code_prefix, code_number_padding
                FROM finance_settings
                WHERE finance_owner_id = :oid
                """
            ),
            {"oid": owner_id},
        ).fetchone()
        if settings is None:
            cust_prefix, loan_prefix, padding = "VMFC", "VMFL", 4
        else:
            cust_prefix, loan_prefix, padding = settings[0], settings[1], int(settings[2])

        customers = conn.execute(
            sa.text(
                """
                SELECT id FROM customers
                WHERE finance_owner_id = :oid
                ORDER BY id ASC
                """
            ),
            {"oid": owner_id},
        ).fetchall()
        for idx, (cid,) in enumerate(customers, start=1):
            code = _format_code(cust_prefix, idx, padding)
            conn.execute(
                sa.text(
                    "UPDATE customers SET display_code = :code WHERE id = :cid"
                ),
                {"code": code, "cid": cid},
            )
        next_cust = len(customers) + 1

        loans = conn.execute(
            sa.text(
                """
                SELECT id FROM loans
                WHERE finance_owner_id = :oid
                ORDER BY id ASC
                """
            ),
            {"oid": owner_id},
        ).fetchall()
        for idx, (lid,) in enumerate(loans, start=1):
            code = _format_code(loan_prefix, idx, padding)
            conn.execute(
                sa.text("UPDATE loans SET display_code = :code WHERE id = :lid"),
                {"code": code, "lid": lid},
            )
        next_loan = len(loans) + 1

        conn.execute(
            sa.text(
                """
                UPDATE finance_settings
                SET customer_code_next = :cn, loan_code_next = :ln
                WHERE finance_owner_id = :oid
                """
            ),
            {"cn": next_cust, "ln": next_loan, "oid": owner_id},
        )

    # Any orphan rows without an owner batch (should be none) get a fallback.
    conn.execute(
        sa.text(
            """
            UPDATE customers
            SET display_code = 'VMFC' || LPAD(id::text, 4, '0')
            WHERE display_code IS NULL
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE loans
            SET display_code = 'VMFL' || LPAD(id::text, 4, '0')
            WHERE display_code IS NULL
            """
        )
    )

    op.alter_column("customers", "display_code", nullable=False)
    op.alter_column("loans", "display_code", nullable=False)

    op.create_unique_constraint(
        "uq_customers_owner_display_code",
        "customers",
        ["finance_owner_id", "display_code"],
    )
    op.create_unique_constraint(
        "uq_loans_owner_display_code",
        "loans",
        ["finance_owner_id", "display_code"],
    )
    op.create_index("ix_customers_display_code", "customers", ["display_code"])
    op.create_index("ix_loans_display_code", "loans", ["display_code"])


def downgrade() -> None:
    op.drop_index("ix_loans_display_code", table_name="loans")
    op.drop_index("ix_customers_display_code", table_name="customers")
    op.drop_constraint("uq_loans_owner_display_code", "loans", type_="unique")
    op.drop_constraint("uq_customers_owner_display_code", "customers", type_="unique")
    op.drop_column("loans", "display_code")
    op.drop_column("customers", "display_code")
    op.drop_column("finance_settings", "loan_code_next")
    op.drop_column("finance_settings", "customer_code_next")
    op.drop_column("finance_settings", "code_number_padding")
    op.drop_column("finance_settings", "loan_code_prefix")
    op.drop_column("finance_settings", "customer_code_prefix")
