from decimal import Decimal

from pydantic import BaseModel


class FinanceFlowDashboardResponse(BaseModel):
    capital_added: Decimal
    available_capital: Decimal
    capital_currently_lent: Decimal
    principal_outstanding: Decimal
    profit_today: Decimal
    profit_this_month: Decimal
    total_profit: Decimal
    available_profit: Decimal
    active_loans: int
    completed_loans: int
    overdue_loans: int
    total_borrowers: int
    expected_today: Decimal
    collected_today: Decimal
    pending_today: Decimal
    collection_rate: Decimal
    unsettled_with_agents: Decimal = Decimal("0")
    pending_settlement_count: int = 0
    pending_settlement_total: Decimal = Decimal("0")
