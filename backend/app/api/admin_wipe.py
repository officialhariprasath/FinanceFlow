"""
One-shot production / admin data wipe.

POST /admin/wipe-all
Body: {"confirm": "DELETE_ALL_DATA"}

Auth (either):
  - Header X-Factory-Reset: FINANCEFLOW_FACTORY_RESET_2026
  - OR Bearer owner token
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from backend.app.core.auth_context import get_current_finance_owner
from backend.app.database.connection import SessionLocal

router = APIRouter(prefix="/admin", tags=["Admin"])

CONFIRM_PHRASE = "DELETE_ALL_DATA"
FACTORY_RESET_HEADER = "FINANCEFLOW_FACTORY_RESET_2026"


class WipeRequest(BaseModel):
    confirm: str = Field(..., description=f'Must be exactly "{CONFIRM_PHRASE}"')


def _run_wipe(wiped_by: str) -> dict:
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

        quoted = ", ".join(f'"{t}"' for t in tables)
        wipe_db.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
        wipe_db.commit()

        return {
            "ok": True,
            "wiped_by": wiped_by,
            "tables": tables,
            "message": "All application data deleted. Register a new owner to start fresh.",
        }
    except Exception as exc:  # noqa: BLE001
        wipe_db.rollback()
        raise HTTPException(status_code=500, detail=f"Wipe failed: {exc}") from exc
    finally:
        wipe_db.close()


@router.post("/wipe-all")
def wipe_all_data(
    body: WipeRequest,
    x_factory_reset: str | None = Header(default=None, alias="X-Factory-Reset"),
    authorization: str | None = Header(default=None),
):
    if body.confirm != CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f'Confirmation failed. Send {{"confirm": "{CONFIRM_PHRASE}"}}',
        )

    expected = os.getenv("ADMIN_WIPE_TOKEN", FACTORY_RESET_HEADER)
    if x_factory_reset and x_factory_reset == expected:
        return _run_wipe("factory-reset-header")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Provide owner Bearer token or X-Factory-Reset header.",
        )

    db = SessionLocal()
    try:
        owner = get_current_finance_owner(
            token=authorization.split(" ", 1)[1].strip(),
            db=db,
        )
        wiped_by = owner.email
        db.expire_all()
        db.rollback()
    finally:
        db.close()

    return _run_wipe(wiped_by)
