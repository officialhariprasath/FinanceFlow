"""
One-shot production / admin data wipe.

POST /admin/wipe-all
Authorization: Bearer <owner token>
Body: {"confirm": "DELETE_ALL_DATA"}
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.core.auth_context import get_current_finance_owner
from backend.app.database.connection import SessionLocal
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner

router = APIRouter(prefix="/admin", tags=["Admin"])

CONFIRM_PHRASE = "DELETE_ALL_DATA"


class WipeRequest(BaseModel):
    confirm: str = Field(..., description=f'Must be exactly "{CONFIRM_PHRASE}"')


@router.post("/wipe-all")
def wipe_all_data(
    body: WipeRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    if body.confirm != CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f'Confirmation failed. Send {{"confirm": "{CONFIRM_PHRASE}"}}',
        )

    wiped_by = owner.email
    # Release any row locks from auth lookup before TRUNCATE (avoids deadlock/timeout).
    db.expire_all()
    db.rollback()

    wipe_db = SessionLocal()
    try:
        rows = wipe_db.execute(
            text(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND tablename <> 'alembic_version'
                ORDER BY tablename
                """
            )
        ).fetchall()
        tables = [r[0] for r in rows]
        if not tables:
            return {
                "ok": True,
                "wiped_by": wiped_by,
                "tables": [],
                "message": "No tables to wipe.",
            }

        # Single statement is fine once locks are released.
        quoted = ", ".join(f'"{t}"' for t in tables)
        wipe_db.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
        wipe_db.commit()
    except Exception as exc:  # noqa: BLE001
        wipe_db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Wipe failed: {exc}",
        ) from exc
    finally:
        wipe_db.close()

    return {
        "ok": True,
        "wiped_by": wiped_by,
        "tables": tables,
        "message": "All application data deleted. Register a new owner to start fresh.",
    }
