from decimal import Decimal

from pydantic import BaseModel


class ProfitSummaryResponse(BaseModel):
    available_profit: Decimal
    total_profit_earned: Decimal
    currency: str
    transaction_count: int
