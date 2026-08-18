from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.auth import require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.schemas.financeflow_dashboard import FinanceFlowDashboardResponse
from backend.app.services.financeflow_dashboard_service import get_financeflow_dashboard

router = APIRouter(
    prefix="/dashboard/financeflow",
    tags=["FinanceFlow Dashboard"],
)


@router.get(
    "",
    response_model=FinanceFlowDashboardResponse,
)
def get_financeflow_dashboard_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["dashboard"])),
):
    return get_financeflow_dashboard(db, ctx.finance_owner_id)
