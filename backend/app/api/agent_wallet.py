from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.agent_wallet import (
    AgentDashboardResponse,
    AgentLedgerEntryResponse,
    AgentWalletBalance,
)
from backend.app.services.agent_wallet_service import (
    get_agent_ledger,
    get_or_create_wallet,
    list_all_agent_wallets,
    wallet_balances_dict,
)
from backend.app.services.agent_settlement_service import (
    get_agent_pending_settlement,
    pending_settlement_dict,
)
from backend.app.services.collection_service import get_today_collections

router = APIRouter(prefix="/agent-wallet", tags=["Agent Wallet"])


def _require_agent(ctx: AuthContext) -> int:
    if ctx.is_owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is for collection agents only.",
        )
    return ctx.actor_id


@router.get("/me", response_model=AgentWalletBalance)
def get_my_wallet(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["settlements"])),
):
    agent_id = _require_agent(ctx)
    wallet = get_or_create_wallet(db, agent_id, ctx.finance_owner_id)
    balances = wallet_balances_dict(wallet)
    pending = get_agent_pending_settlement(db, agent_id, ctx.finance_owner_id)
    pending_info = pending_settlement_dict(pending)
    return AgentWalletBalance(
        agent_id=agent_id,
        unsettled_balance=balances["total_balance"],
        pending_settlement_total=pending_info["pending_settlement_total"],
        has_pending_settlement=pending_info["has_pending_settlement"],
        **balances,
    )


@router.get("/me/ledger", response_model=list[AgentLedgerEntryResponse])
def get_my_ledger(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["settlements"])),
    limit: int = Query(200, le=500),
):
    agent_id = _require_agent(ctx)
    return get_agent_ledger(db, agent_id, ctx.finance_owner_id, limit=limit)


@router.get("/me/dashboard", response_model=AgentDashboardResponse)
def get_my_dashboard(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["collections"])),
):
    agent_id = _require_agent(ctx)
    summary = get_today_collections(
        db,
        ctx.finance_owner_id,
        agent_id=agent_id,
    )
    wallet = get_or_create_wallet(db, agent_id, ctx.finance_owner_id)
    balances = wallet_balances_dict(wallet)
    pending = get_agent_pending_settlement(db, agent_id, ctx.finance_owner_id)
    pending_info = pending_settlement_dict(pending)
    from decimal import Decimal

    zero = Decimal("0.00")
    reconciliation_diff = (summary["collected"] - balances["total_balance"]).quantize(zero)
    if reconciliation_diff < zero:
        reconciliation_diff = zero
    return AgentDashboardResponse(
        expected_today=summary["expected_collection"],
        collected_today=summary["collected"],
        pending_today=summary["pending"],
        wallet=AgentWalletBalance(
            agent_id=agent_id,
            unsettled_balance=balances["total_balance"],
            pending_settlement_total=pending_info["pending_settlement_total"],
            has_pending_settlement=pending_info["has_pending_settlement"],
            **balances,
        ),
        reconciliation_difference=reconciliation_diff,
        is_balanced=reconciliation_diff == zero,
    )


@router.get("/agents", response_model=list[AgentWalletBalance])
def list_agent_wallets(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["agents"])),
):
    if not ctx.is_owner:
        raise HTTPException(status_code=403, detail="Owner access required.")
    return list_all_agent_wallets(db, ctx.finance_owner_id)


@router.get("/agents/{agent_id}", response_model=AgentWalletBalance)
def get_agent_wallet(
    agent_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    wallet = get_or_create_wallet(db, agent_id, owner.id)
    balances = wallet_balances_dict(wallet)
    return AgentWalletBalance(agent_id=agent_id, **balances)


@router.get("/agents/{agent_id}/ledger", response_model=list[AgentLedgerEntryResponse])
def get_agent_ledger_endpoint(
    agent_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
    limit: int = Query(200, le=500),
):
    return get_agent_ledger(db, agent_id, owner.id, limit=limit)
