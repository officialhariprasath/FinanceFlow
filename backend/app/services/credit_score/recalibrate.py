"""Optional scorecardpy recalibration when enough labeled history exists."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.credit_score import ScorecardDefinition
from backend.app.models.loan import Loan
from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION
from backend.app.services.credit_score.feature_builder import build_customer_features


MIN_LABELED = 30
MIN_BAD = 5
MIN_GOOD = 10


def _label_loan(loan: Loan) -> int | None:
    if loan.status == "DEFAULTED":
        return 1
    if loan.status == "CLOSED":
        # Treat settlement with large waiver as weaker signal; still "good" if closed.
        return 0
    return None


def recalibrate_scorecard(db: Session, finance_owner_id: int) -> dict:
    try:
        import scorecardpy as sc  # type: ignore
        import pandas as pd  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scorecardpy is not installed on this server. Expert scorecard remains active.",
        ) from exc

    loans = (
        db.query(Loan)
        .filter(Loan.finance_owner_id == finance_owner_id)
        .all()
    )
    rows = []
    for loan in loans:
        label = _label_loan(loan)
        if label is None:
            continue
        features = build_customer_features(db, finance_owner_id, loan.customer_id)
        row = {k: v for k, v in features.items() if k not in ("computed_as_of", "computed_at", "file_type")}
        row["creditability"] = label
        rows.append(row)

    if len(rows) < MIN_LABELED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_LABELED} labeled loans to recalibrate (have {len(rows)}).",
        )
    bad = sum(1 for r in rows if r["creditability"] == 1)
    good = sum(1 for r in rows if r["creditability"] == 0)
    if bad < MIN_BAD or good < MIN_GOOD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_GOOD} good and {MIN_BAD} bad outcomes (good={good}, bad={bad}).",
        )

    df = pd.DataFrame(rows)
    # Keep numeric columns that exist in the expert card.
    keep = [c for c in EXPERT_DEFINITION["features"].keys() if c in df.columns]
    keep.append("creditability")
    df = df[keep].copy()
    for col in df.columns:
        if col != "creditability":
            df[col] = pd.to_numeric(df[col], errors="coerce")

    try:
        bins = sc.woebin(df, y="creditability")
        df_woe = sc.woebin_ply(df, bins)
        y = df_woe["creditability"]
        x = df_woe.drop(columns=["creditability"])
        from sklearn.linear_model import LogisticRegression

        lr = LogisticRegression(max_iter=200)
        lr.fit(x, y)
        card = sc.scorecard(bins, lr, x.columns)
        # Preserve runtime shape: keep expert definition (stable API) and store
        # scorecardpy artifact alongside for inspection.
        version = f"scpy-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        definition = {
            **EXPERT_DEFINITION,
            "scorecardpy_card": card,
            "note": "Weights recalibrated; runtime still uses expert bins until card mapper lands.",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recalibration failed: {exc}",
        ) from exc

    db.query(ScorecardDefinition).filter(
        ScorecardDefinition.finance_owner_id == finance_owner_id,
        ScorecardDefinition.is_active.is_(True),
    ).update({"is_active": False})

    row = ScorecardDefinition(
        finance_owner_id=finance_owner_id,
        version=version,
        is_active=True,
        definition_json=definition,
        source="SCORECARDPY",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "version": row.version,
        "source": row.source,
        "labeled_rows": len(rows),
        "good": good,
        "bad": bad,
    }
