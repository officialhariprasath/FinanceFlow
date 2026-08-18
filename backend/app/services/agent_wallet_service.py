from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.agent_wallet import AgentWallet
from backend.app.models.agent_ledger_entry import AgentLedgerEntry
from backend.app.models.enums import AgentLedgerEntryType, WalletChannel, PaymentMode

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def payment_mode_to_channel(payment_mode: str | object) -> str:
    if hasattr(payment_mode, "value"):
        payment_mode = payment_mode.value
    mode = str(payment_mode).strip().lower()
    if "cash" in mode:
        return WalletChannel.CASH.value
    if "upi" in mode:
        return WalletChannel.UPI.value
    return WalletChannel.OTHER.value


def get_or_create_wallet(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
) -> AgentWallet:
    wallet = (
        db.query(AgentWallet)
        .filter(
            AgentWallet.agent_id == agent_id,
            AgentWallet.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if wallet is None:
        wallet = AgentWallet(
            agent_id=agent_id,
            finance_owner_id=finance_owner_id,
            cash_balance=ZERO,
            upi_balance=ZERO,
            other_balance=ZERO,
        )
        db.add(wallet)
        db.flush()
    return wallet


def wallet_total(wallet: AgentWallet) -> Decimal:
    return (
        Decimal(wallet.cash_balance)
        + Decimal(wallet.upi_balance)
        + Decimal(wallet.other_balance)
    ).quantize(TWOPLACES)


def wallet_balances_dict(wallet: AgentWallet) -> dict:
    cash = Decimal(wallet.cash_balance).quantize(TWOPLACES)
    upi = Decimal(wallet.upi_balance).quantize(TWOPLACES)
    other = Decimal(wallet.other_balance).quantize(TWOPLACES)
    return {
        "cash_balance": cash,
        "upi_balance": upi,
        "other_balance": other,
        "total_balance": (cash + upi + other).quantize(TWOPLACES),
    }


def credit_agent_wallet(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
    channel: str,
    amount: Decimal,
    payment_id: int | None = None,
    payment_reference: str | None = None,
    notes: str | None = None,
) -> AgentLedgerEntry:
    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit amount must be positive.",
        )

    wallet = get_or_create_wallet(db, agent_id, finance_owner_id)

    if channel == WalletChannel.CASH.value:
        wallet.cash_balance = Decimal(wallet.cash_balance) + amount
    elif channel == WalletChannel.UPI.value:
        wallet.upi_balance = Decimal(wallet.upi_balance) + amount
    else:
        wallet.other_balance = Decimal(wallet.other_balance) + amount

    balance_after = wallet_total(wallet)

    entry = AgentLedgerEntry(
        agent_id=agent_id,
        finance_owner_id=finance_owner_id,
        entry_type=AgentLedgerEntryType.COLLECTION.value,
        channel=channel,
        credit_amount=amount,
        debit_amount=ZERO,
        balance_after=balance_after,
        payment_id=payment_id,
        payment_reference=payment_reference,
        notes=notes,
    )
    db.add(entry)
    db.flush()
    return entry


def debit_agent_wallet(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
    channel: str,
    amount: Decimal,
    settlement_id: int,
    notes: str | None = None,
) -> AgentLedgerEntry:
    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        return None

    wallet = get_or_create_wallet(db, agent_id, finance_owner_id)

    if channel == WalletChannel.CASH.value:
        current = Decimal(wallet.cash_balance)
        if amount > current:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient cash balance for settlement.",
            )
        wallet.cash_balance = current - amount
    elif channel == WalletChannel.UPI.value:
        current = Decimal(wallet.upi_balance)
        if amount > current:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient UPI balance for settlement.",
            )
        wallet.upi_balance = current - amount
    else:
        current = Decimal(wallet.other_balance)
        if amount > current:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient other balance for settlement.",
            )
        wallet.other_balance = current - amount

    balance_after = wallet_total(wallet)

    entry = AgentLedgerEntry(
        agent_id=agent_id,
        finance_owner_id=finance_owner_id,
        entry_type=AgentLedgerEntryType.SETTLEMENT.value,
        channel=channel,
        credit_amount=ZERO,
        debit_amount=amount,
        balance_after=balance_after,
        settlement_id=settlement_id,
        notes=notes,
    )
    db.add(entry)
    db.flush()
    return entry


def get_agent_ledger(
    db: Session,
    agent_id: int,
    finance_owner_id: int,
    limit: int = 200,
):
    return (
        db.query(AgentLedgerEntry)
        .filter(
            AgentLedgerEntry.agent_id == agent_id,
            AgentLedgerEntry.finance_owner_id == finance_owner_id,
        )
        .order_by(AgentLedgerEntry.created_at.desc(), AgentLedgerEntry.id.desc())
        .limit(limit)
        .all()
    )


def list_all_agent_wallets(db: Session, finance_owner_id: int):
    from backend.app.models.agent import Agent
    from backend.app.models.payment import Payment
    from backend.app.models.agent_settlement import AgentSettlement
    from backend.app.models.enums import SettlementStatus
    from datetime import date

    today = date.today()
    agents = (
        db.query(Agent)
        .filter(Agent.finance_owner_id == finance_owner_id, Agent.is_active.is_(True))
        .order_by(Agent.full_name)
        .all()
    )

    pending_rows = (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status == SettlementStatus.PENDING_VERIFICATION.value,
        )
        .all()
    )
    pending_by_agent: dict[int, AgentSettlement] = {
        row.agent_id: row for row in pending_rows
    }

    results = []
    for agent in agents:
        wallet = get_or_create_wallet(db, agent.id, finance_owner_id)
        balances = wallet_balances_dict(wallet)

        today_collected = (
            db.query(Payment)
            .filter(
                Payment.collected_by_agent_id == agent.id,
                Payment.finance_owner_id == finance_owner_id,
                Payment.payment_date == today,
            )
            .all()
        )
        today_total = sum(
            (Decimal(p.amount_paid) for p in today_collected),
            ZERO,
        ).quantize(TWOPLACES)

        unsettled = balances["total_balance"]
        pending = pending_by_agent.get(agent.id)
        pending_total = (
            Decimal(pending.total_amount).quantize(TWOPLACES) if pending else ZERO
        )
        status = "green"
        if unsettled > ZERO and unsettled < Decimal("5000"):
            status = "yellow"
        elif unsettled >= Decimal("5000"):
            status = "red"
        if pending is not None:
            status = "yellow"

        results.append(
            {
                "agent_id": agent.id,
                "agent_name": agent.full_name,
                "assigned_area": agent.assigned_area,
                "today_collected": today_total,
                "unsettled_balance": unsettled,
                "pending_settlement_total": pending_total,
                "has_pending_settlement": pending is not None,
                "status": status,
                **balances,
            }
        )
    return results
