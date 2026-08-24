"""
One-shot production / admin data wipe.

POST /admin/wipe-all
Authorization: Bearer <owner token>
Body: {"confirm": "DELETE_ALL_DATA"}

Truncates every public table except alembic_version.
Does NOT drop schema/migrations — app stays deployable for fresh registration.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.core.auth_context import get_current_finance_owner
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

    rows = db.execute(
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
            "wiped_by": owner.email,
            "tables": [],
            "message": "No tables to wipe.",
        }

    quoted = ", ".join(f'"{t}"' for t in tables)
    db.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
    db.commit()

    return {
        "ok": True,
        "wiped_by": owner.email,
        "tables": tables,
        "message": "All application data deleted. Register a new owner to start fresh.",
    }
