from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.agent import Agent
from backend.app.models.agent_settlement import AgentSettlement
from backend.app.models.enums import SettlementStatus, WalletChannel
from backend.app.services.settlement_delivery import (
    delivery_summary,
    validate_settlement_delivery,
)
from backend.app.services.agent_wallet_service import (
    debit_agent_wallet,
    get_or_create_wallet,
    wallet_balances_dict,
    wallet_total,
    ZERO,
    TWOPLACES,
)

ACTIVE_STATUSES = {
    SettlementStatus.SUBMITTED.value,
    SettlementStatus.PENDING_VERIFICATION.value,
    SettlementStatus.APPROVED.value,
}

PENDING_STATUS = SettlementStatus.PENDING_VERIFICATION.value


def get_agent_pending_settlement(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
) -> AgentSettlement | None:
    return (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.agent_id == agent_id,
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status == PENDING_STATUS,
        )
        .first()
    )


def count_pending_settlements(db: Session, finance_owner_id: int) -> int:
    return (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status == PENDING_STATUS,
        )
        .count()
    )


def sum_pending_settlement_totals(db: Session, finance_owner_id: int) -> Decimal:
    from sqlalchemy import func

    total = (
        db.query(func.coalesce(func.sum(AgentSettlement.total_amount), ZERO))
        .filter(
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status == PENDING_STATUS,
        )
        .scalar()
    )
    return Decimal(total or ZERO).quantize(TWOPLACES)


def pending_settlement_dict(settlement: AgentSettlement | None) -> dict:
    if settlement is None:
        return {
            "has_pending_settlement": False,
            "pending_settlement_id": None,
            "pending_settlement_total": ZERO,
            "pending_cash_amount": ZERO,
            "pending_upi_amount": ZERO,
            "pending_other_amount": ZERO,
        }
    return {
        "has_pending_settlement": True,
        "pending_settlement_id": settlement.id,
        "pending_settlement_total": Decimal(settlement.total_amount).quantize(TWOPLACES),
        "pending_cash_amount": Decimal(settlement.cash_amount).quantize(TWOPLACES),
        "pending_upi_amount": Decimal(settlement.upi_amount).quantize(TWOPLACES),
        "pending_other_amount": Decimal(settlement.other_amount).quantize(TWOPLACES),
    }


def create_settlement(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
    cash_amount: Decimal,
    upi_amount: Decimal,
    other_amount: Decimal,
    delivery_method: str,
    delivery_cash_amount: Decimal,
    delivery_upi_amount: Decimal,
    delivery_other_amount: Decimal,
    transfer_reference: str | None,
    transfer_date: date | None,
    proof_notes: str | None,
    reconciliation_note: str | None,
) -> AgentSettlement:
    cash_amount = cash_amount.quantize(TWOPLACES)
    upi_amount = upi_amount.quantize(TWOPLACES)
    other_amount = other_amount.quantize(TWOPLACES)
    total = (cash_amount + upi_amount + other_amount).quantize(TWOPLACES)

    if total <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settlement total must be greater than zero.",
        )

    if get_agent_pending_settlement(db, agent_id, finance_owner_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a settlement pending approval. Wait for the owner to review it.",
        )

    wallet = get_or_create_wallet(db, agent_id, finance_owner_id)
    balances = wallet_balances_dict(wallet)

    if cash_amount > balances["cash_balance"]:
        raise HTTPException(status_code=400, detail="Cash cleared exceeds cash balance.")
    if upi_amount > balances["upi_balance"]:
        raise HTTPException(status_code=400, detail="UPI cleared exceeds UPI balance.")
    if other_amount > balances["other_balance"]:
        raise HTTPException(status_code=400, detail="Other cleared exceeds other balance.")

    delivery_cash, delivery_upi, delivery_other, method = validate_settlement_delivery(
        total_cleared=total,
        delivery_method=delivery_method,
        delivery_cash=delivery_cash_amount,
        delivery_upi=delivery_upi_amount,
        delivery_other=delivery_other_amount,
        transfer_reference=transfer_reference,
    )

    settlement = AgentSettlement(
        agent_id=agent_id,
        finance_owner_id=finance_owner_id,
        status=SettlementStatus.PENDING_VERIFICATION.value,
        cash_amount=cash_amount,
        upi_amount=upi_amount,
        other_amount=other_amount,
        total_amount=total,
        delivery_method=method,
        delivery_cash_amount=delivery_cash,
        delivery_upi_amount=delivery_upi,
        delivery_other_amount=delivery_other,
        transfer_reference=(transfer_reference or "").strip() or None,
        transfer_date=transfer_date,
        proof_notes=proof_notes,
        reconciliation_note=reconciliation_note,
    )
    db.add(settlement)
    db.flush()

    from backend.app.models.agent import Agent
    from backend.app.services.audit_service import log_audit
    from backend.app.services.notification_service import create_notification

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    agent_label = agent.full_name if agent else f"Agent #{agent_id}"

    log_audit(
        db,
        finance_owner_id,
        action="SETTLEMENT_SUBMITTED",
        entity_type="agent_settlement",
        entity_id=settlement.id,
        details=f"{agent_label} submitted ₹{total} for settlement ({method} delivery).",
        actor_type="agent",
        actor_id=agent_id,
    )
    create_notification(
        db,
        finance_owner_id,
        title="Settlement pending approval",
        message=f"{agent_label} submitted a settlement of ₹{total}. Review in Agent Settlements.",
        level="info",
        action_url="/agent-settlements",
    )

    db.commit()
    db.refresh(settlement)
    return settlement


def list_settlements_for_agent(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
):
    return (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.agent_id == agent_id,
            AgentSettlement.finance_owner_id == finance_owner_id,
        )
        .order_by(AgentSettlement.submitted_at.desc())
        .all()
    )


def list_pending_settlements(db: Session, finance_owner_id: int):
    return (
        db.query(AgentSettlement, Agent)
        .join(Agent, AgentSettlement.agent_id == Agent.id)
        .filter(
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status == SettlementStatus.PENDING_VERIFICATION.value,
        )
        .order_by(AgentSettlement.submitted_at.asc())
        .all()
    )


def list_all_settlements(db: Session, finance_owner_id: int, status_filter: str | None = None):
    q = (
        db.query(AgentSettlement, Agent)
        .join(Agent, AgentSettlement.agent_id == Agent.id)
        .filter(AgentSettlement.finance_owner_id == finance_owner_id)
    )
    if status_filter:
        q = q.filter(AgentSettlement.status == status_filter)
    return q.order_by(AgentSettlement.submitted_at.desc()).all()


def approve_settlement(
    db: Session,
    settlement_id: int,
    finance_owner_id: int,
    owner_id: int,
) -> AgentSettlement:
    settlement = (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.id == settlement_id,
            AgentSettlement.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found.")

    if settlement.status not in (
        SettlementStatus.PENDING_VERIFICATION.value,
        SettlementStatus.SUBMITTED.value,
    ):
        raise HTTPException(status_code=400, detail="Settlement cannot be approved.")

    wallet = get_or_create_wallet(db, settlement.agent_id, finance_owner_id)
    balances = wallet_balances_dict(wallet)

    if settlement.cash_amount > balances["cash_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient agent cash balance.")
    if settlement.upi_amount > balances["upi_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient agent UPI balance.")
    if settlement.other_amount > balances["other_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient agent other balance.")

    received_note = delivery_summary(
        settlement.delivery_method,
        Decimal(settlement.delivery_cash_amount),
        Decimal(settlement.delivery_upi_amount),
        Decimal(settlement.delivery_other_amount),
        settlement.transfer_reference,
    )

    if Decimal(settlement.cash_amount) > ZERO:
        debit_agent_wallet(
            db,
            settlement.agent_id,
            finance_owner_id,
            WalletChannel.CASH.value,
            Decimal(settlement.cash_amount),
            settlement.id,
            notes=f"Settlement approved. {received_note}",
        )
    if Decimal(settlement.upi_amount) > ZERO:
        debit_agent_wallet(
            db,
            settlement.agent_id,
            finance_owner_id,
            WalletChannel.UPI.value,
            Decimal(settlement.upi_amount),
            settlement.id,
            notes=f"Settlement approved. {received_note}",
        )
    if Decimal(settlement.other_amount) > ZERO:
        debit_agent_wallet(
            db,
            settlement.agent_id,
            finance_owner_id,
            WalletChannel.OTHER.value,
            Decimal(settlement.other_amount),
            settlement.id,
            notes=f"Settlement approved. {received_note}",
        )

    from datetime import datetime

    settlement.status = SettlementStatus.COMPLETED.value
    settlement.reviewed_at = datetime.utcnow()
    settlement.reviewed_by_owner_id = owner_id

    from backend.app.services.audit_service import log_audit
    from backend.app.services.notification_service import create_notification

    log_audit(
        db,
        finance_owner_id,
        action="SETTLEMENT_APPROVED",
        entity_type="agent_settlement",
        entity_id=settlement.id,
        details=f"Approved settlement #{settlement.id} for ₹{settlement.total_amount}. {received_note}",
        actor_type="owner",
        actor_id=owner_id,
    )
    create_notification(
        db,
        finance_owner_id,
        title="Settlement approved",
        message=f"Your settlement of ₹{settlement.total_amount} was approved. Wallet balances updated.",
        level="success",
        recipient_agent_id=settlement.agent_id,
        action_url="/settlements",
    )

    db.commit()
    db.refresh(settlement)
    return settlement


def reject_settlement(
    db: Session,
    settlement_id: int,
    finance_owner_id: int,
    owner_id: int,
    reason: str,
) -> AgentSettlement:
    settlement = (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.id == settlement_id,
            AgentSettlement.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found.")

    if settlement.status != SettlementStatus.PENDING_VERIFICATION.value:
        raise HTTPException(status_code=400, detail="Settlement cannot be rejected.")

    from datetime import datetime

    settlement.status = SettlementStatus.REJECTED.value
    settlement.rejection_reason = reason
    settlement.reviewed_at = datetime.utcnow()
    settlement.reviewed_by_owner_id = owner_id

    from backend.app.services.audit_service import log_audit
    from backend.app.services.notification_service import create_notification

    log_audit(
        db,
        finance_owner_id,
        action="SETTLEMENT_REJECTED",
        entity_type="agent_settlement",
        entity_id=settlement.id,
        details=f"Rejected settlement #{settlement.id}: {reason}",
        actor_type="owner",
        actor_id=owner_id,
    )
    create_notification(
        db,
        finance_owner_id,
        title="Settlement rejected",
        message=f"Your settlement of ₹{settlement.total_amount} was rejected. Reason: {reason}",
        level="warning",
        recipient_agent_id=settlement.agent_id,
        action_url="/settlements",
    )

    db.commit()
    db.refresh(settlement)
    return settlement


def settlement_to_dict(settlement: AgentSettlement, agent_name: str | None = None) -> dict:
    return {
        "id": settlement.id,
        "agent_id": settlement.agent_id,
        "agent_name": agent_name,
        "status": settlement.status,
        "cash_amount": settlement.cash_amount,
        "upi_amount": settlement.upi_amount,
        "other_amount": settlement.other_amount,
        "total_amount": settlement.total_amount,
        "delivery_method": settlement.delivery_method,
        "delivery_cash_amount": settlement.delivery_cash_amount,
        "delivery_upi_amount": settlement.delivery_upi_amount,
        "delivery_other_amount": settlement.delivery_other_amount,
        "transfer_reference": settlement.transfer_reference,
        "transfer_date": settlement.transfer_date,
        "proof_notes": settlement.proof_notes,
        "rejection_reason": settlement.rejection_reason,
        "reconciliation_note": settlement.reconciliation_note,
        "submitted_at": settlement.submitted_at,
        "reviewed_at": settlement.reviewed_at,
    }
