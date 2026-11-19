from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.credit_score import CreditScoreResponse, RecalibrateResponse
from backend.app.services.credit_score.recalibrate import recalibrate_scorecard
from backend.app.services.credit_score.score_service import (
    compute_customer_score,
    ensure_platform_expert_scorecard,
    get_or_compute_customer_score,
    score_to_response_dict,
)

router = APIRouter(prefix="/credit-score", tags=["Credit Score"])


@router.get(
    "/customers/{customer_id}",
    response_model=CreditScoreResponse,
)
def get_customer_credit_score(
    customer_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["customers"])),
):
    ensure_platform_expert_scorecard(db)
    row = get_or_compute_customer_score(db, ctx.finance_owner_id, customer_id)
    return score_to_response_dict(row)


@router.post(
    "/customers/{customer_id}/refresh",
    response_model=CreditScoreResponse,
)
def refresh_customer_credit_score(
    customer_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["customers"])),
):
    ensure_platform_expert_scorecard(db)
    row = compute_customer_score(db, ctx.finance_owner_id, customer_id)
    return score_to_response_dict(row)


@router.post(
    "/recalibrate",
    response_model=RecalibrateResponse,
)
def recalibrate_credit_scorecard(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return recalibrate_scorecard(db, owner.id)
