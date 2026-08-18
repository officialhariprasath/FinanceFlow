from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.auth import require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.schemas.profit import ProfitSummaryResponse
from backend.app.services.profit_service import get_profit_summary

router = APIRouter(
    prefix="/profit",
    tags=["Profit"],
)


@router.get(
    "/summary",
    response_model=ProfitSummaryResponse,
)
def get_profit_summary_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["profit"])),
):
    return get_profit_summary(db, ctx.finance_owner_id)
