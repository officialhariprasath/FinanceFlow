from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class CreditScoreReason(BaseModel):
    code: str
    label: str
    points: int
    feature: Optional[str] = None


class CreditScoreResponse(BaseModel):
    customer_id: int
    score: int
    band: str
    file_type: str
    suggested_max_amount: Decimal
    reasons: list[CreditScoreReason] = Field(default_factory=list)
    features: dict[str, Any] = Field(default_factory=dict)
    scorecard_version: str
    computed_at: Optional[datetime] = None
    advisory_only: bool = True

    model_config = ConfigDict(from_attributes=True)


class RecalibrateResponse(BaseModel):
    version: str
    source: str
    labeled_rows: int
    good: int
    bad: int
