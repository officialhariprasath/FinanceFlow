"""One-time / idempotent repairs for capital double-counting."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models.capital_transaction import CapitalTransaction
from backend.app.models.enums import LedgerDirection
from backend.app.services.audit_service import log_audit
from backend.app.services.capital_location_service import get_capital_location_summary
from backend.app.services.capital_service import (
    ZERO,
    TWOPLACES,
    get_or_create_capital_account,
    record_capital_adjustment,
)

# Known mistaken Add Capital rows on Velumurgan / owner id 2 production
# (settlement approve followed by Add Capital of the same amount).
DEFAULT_RECYCLE_MATCHERS = (
    "settled and reinvested",
)


def _already_reversed(db: Session, capital_account_id: int, capital_added_id: int) -> bool:
    return (
        db.query(CapitalTransaction)
        .filter(
            CapitalTransaction.capital_account_id == capital_account_id,
            CapitalTransaction.type == "CAPITAL_ADJUSTMENT",
            CapitalTransaction.reference_type == "REVERSE_CAPITAL_ADDED",
            CapitalTransaction.reference_id == capital_added_id,
        )
        .first()
        is not None
    )


def find_settlement_recycle_adds(
    db: Session,
    finance_owner_id: int,
) -> list[CapitalTransaction]:
    account = get_or_create_capital_account(db, finance_owner_id)
    rows = (
        db.query(CapitalTransaction)
        .filter(
            CapitalTransaction.capital_account_id == account.id,
            CapitalTransaction.type == "CAPITAL_ADDED",
            CapitalTransaction.direction == "CREDIT",
        )
        .order_by(CapitalTransaction.created_at.asc())
        .all()
    )

    from datetime import timedelta

    from backend.app.models.agent_settlement import AgentSettlement
    from backend.app.models.enums import SettlementStatus

    suspects: list[CapitalTransaction] = []
    for row in rows:
        if _already_reversed(db, account.id, row.id):
            continue
        desc = (row.description or "").strip().lower()
        matched_desc = any(m in desc for m in DEFAULT_RECYCLE_MATCHERS)
        # Also match Add Capital within 10 minutes after a same-amount settlement approve
        window_start = row.created_at - timedelta(minutes=10)
        window_end = row.created_at + timedelta(minutes=1)
        settle = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.finance_owner_id == finance_owner_id,
                AgentSettlement.status.in_(
                    [
                        SettlementStatus.COMPLETED.value,
                        SettlementStatus.APPROVED.value,
                    ]
                ),
                AgentSettlement.reviewed_at.isnot(None),
                AgentSettlement.reviewed_at >= window_start,
                AgentSettlement.reviewed_at <= window_end,
                AgentSettlement.total_amount == row.amount,
            )
            .first()
        )
        if matched_desc or settle is not None:
            suspects.append(row)
    return suspects


def preview_settlement_recycle_repair(db: Session, finance_owner_id: int) -> dict:
    suspects = find_settlement_recycle_adds(db, finance_owner_id)
    total = sum((Decimal(r.amount) for r in suspects), ZERO).quantize(TWOPLACES)
    before = get_capital_location_summary(db, finance_owner_id)
    return {
        "repair_needed": len(suspects) > 0,
        "entries": [
            {
                "capital_transaction_id": r.id,
                "amount": Decimal(r.amount).quantize(TWOPLACES),
                "description": r.description,
                "created_at": r.created_at,
            }
            for r in suspects
        ],
        "total_to_reverse": total,
        "before": before,
        "message": (
            f"Will reverse ₹{total} of Add Capital that recycled approved settlements. "
            "Loans, customers, payments, and agent wallets are not modified."
            if suspects
            else "No settlement-recycle Add Capital entries found (already repaired or clean)."
        ),
    }


def apply_settlement_recycle_repair(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
) -> dict:
    preview = preview_settlement_recycle_repair(db, finance_owner_id)
    if not preview["repair_needed"]:
        return {**preview, "applied": False, "after": preview["before"]}

    created = []
    for entry in preview["entries"]:
        tx = record_capital_adjustment(
            db=db,
            finance_owner_id=finance_owner_id,
            amount=Decimal(entry["amount"]),
            direction=LedgerDirection.DEBIT,
            description=(
                f"Reverse double-counted Add Capital #{entry['capital_transaction_id']} "
                f"({entry['description'] or 'no description'}) — settlement recycle repair"
            ),
            reference_type="REVERSE_CAPITAL_ADDED",
            reference_id=entry["capital_transaction_id"],
            commit=False,
        )
        created.append(tx.id)
        log_audit(
            db,
            finance_owner_id,
            "CAPITAL_RECYCLE_REPAIR",
            "capital_transaction",
            tx.id,
            f"Reversed Add Capital #{entry['capital_transaction_id']} for ₹{entry['amount']}",
            actor_type="owner",
            actor_id=owner_id,
        )

    db.commit()
    after = get_capital_location_summary(db, finance_owner_id)
    return {
        **preview,
        "applied": True,
        "adjustment_ids": created,
        "after": after,
        "message": (
            f"Reversed ₹{preview['total_to_reverse']} double-counted capital. "
            "Available to lend and Total capital added updated. "
            "Loans and agent wallets unchanged."
        ),
    }
