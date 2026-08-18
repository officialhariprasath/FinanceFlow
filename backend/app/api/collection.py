from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.auth import require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.schemas.collection import CollectionSummaryResponse
from backend.app.services.collection_service import get_today_collections

router = APIRouter(
    prefix="/collections",
    tags=["Collections"],
)


@router.get(
    "/today",
    response_model=CollectionSummaryResponse,
)
def get_today_collections_endpoint(
    target_date: date | None = Query(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["collections"])),
):
    return get_today_collections(
        db=db,
        finance_owner_id=ctx.finance_owner_id,
        target_date=target_date,
        agent_id=ctx.actor_id if not ctx.is_owner else None,
    )
