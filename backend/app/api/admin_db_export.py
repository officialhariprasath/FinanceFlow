"""
Owner-only full database export for migration / backup.

GET /admin/database-export
Authorization: Bearer <owner token>
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner

router = APIRouter(prefix="/admin", tags=["Admin"])


def _json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    raise TypeError(f"Unsupported type: {type(value)}")


@router.get("/database-export")
def export_database(
    db: Session = Depends(get_db),
    _owner: FinanceOwner = Depends(get_current_finance_owner),
):
    inspector = inspect(db.bind)
    tables = sorted(
        t
        for t in inspector.get_table_names(schema="public")
        if t != "alembic_version"
    )

    payload: dict[str, list[dict]] = {}
    counts: dict[str, int] = {}

    for table in tables:
        rows = db.execute(text(f'SELECT * FROM "{table}"')).mappings().all()
        payload[table] = [dict(row) for row in rows]
        counts[table] = len(payload[table])

    export = {
        "version": 1,
        "tables": payload,
        "counts": counts,
    }

    body = json.dumps(export, default=_json_default, ensure_ascii=False)
    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="financeflow-db-export.json"',
        },
    )
