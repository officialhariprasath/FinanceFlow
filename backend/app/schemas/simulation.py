"""Pydantic API schemas for the simulation module."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


class LoanProductIn(BaseModel):
    product_id: str = "P1"
    name: str = ""
    principal: Decimal
    installment_amount: Decimal
    installment_principal: Decimal
    installment_profit: Decimal
    installment_count: int
    frequency: str = "DAILY"
    custom_interval_days: int = 1
    profit_model: str = "FIXED_INSTALLMENT"
    fixed_total_profit: Optional[Decimal] = None
    profit_percentage: Optional[Decimal] = None
    same_day_collection: bool = False
    weight: int = 1


class ReinvestmentIn(BaseModel):
    percentage: Decimal = Decimal("100")
    mode: str = "TOTAL_ELIGIBLE_CASH"


class WithdrawalIn(BaseModel):
    percentage: Decimal = Decimal("0")
    start_day: int = 0
    frequency: str = "DAILY"
    custom_interval_days: int = 1


class TargetIn(BaseModel):
    target_type: str = "MONTHLY_PROFIT"
    target_value: Decimal
    monthly_method: str = "RUN_RATE_X30"


class RiskIn(BaseModel):
    preset: str = "OPTIMISTIC"
    collection_efficiency: Decimal = Decimal("100")
    default_rate: Decimal = Decimal("0")
    delayed_payment_rate: Decimal = Decimal("0")
    idle_cash_percent: Decimal = Decimal("0")
    operating_expense_per_day: Decimal = Decimal("0")
    other_expense_per_day: Decimal = Decimal("0")
    agent_commission_percent: Decimal = Decimal("0")


class SimulationRunRequest(BaseModel):
    simulation_mode: str = "HYPOTHETICAL"
    capital_source: str = "MANUAL"
    manual_starting_capital: Decimal = Decimal("0")
    additional_capital: Decimal = Decimal("0")
    products: list[LoanProductIn] = Field(default_factory=list)
    reinvestment: ReinvestmentIn = Field(default_factory=ReinvestmentIn)
    withdrawal: WithdrawalIn = Field(default_factory=WithdrawalIn)
    target: TargetIn
    simulation_days: int = 365
    start_date: Optional[date] = None
    risk: RiskIn = Field(default_factory=RiskIn)
    deploy_on_start_day: bool = True
    scenario_name: str = ""
    include_daily: bool = True
    include_aggregates: bool = True
    max_daily_rows: int = 400


class SimulationSummaryOut(BaseModel):
    target_type: str
    target_value: Decimal
    target_status: str
    target_day: Optional[int] = None
    target_date: Optional[date] = None
    days_required: Optional[int] = None
    active_loans_at_target: Optional[int] = None
    daily_collection_at_target: Optional[Decimal] = None
    daily_profit_at_target: Optional[Decimal] = None
    monthly_profit_at_target: Optional[Decimal] = None
    reinvestment_pct: Decimal
    owner_withdrawal_at_target: Optional[Decimal] = None
    portfolio_at_target: Optional[Decimal] = None
    available_cash_at_target: Optional[Decimal] = None
    cumulative_profit_at_target: Optional[Decimal] = None
    max_target_metric: Decimal
    max_target_day: int


class DailyRowOut(BaseModel):
    date: date
    day: int
    starting_cash: Decimal
    active_loans: int
    loans_completing: int
    collection: Decimal
    principal_recovery: Decimal
    profit: Decimal
    reinvested_amount: Decimal
    withdrawn_profit: Decimal
    new_loans: int
    capital_deployed: Decimal
    ending_cash: Decimal
    outstanding_principal: Decimal
    total_portfolio: Decimal
    cumulative_profit: Decimal
    daily_profit_x30: Decimal
    target_metric: Decimal
    target_progress_pct: Decimal
    target_reached: bool
    explain: Optional[dict[str, Any]] = None


class SnapshotOut(BaseModel):
    snapshot_date: date
    available_cash: Decimal
    outstanding_principal: Decimal
    active_loan_count: int
    currency: str = "INR"
    products: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class SimulationRunResponse(BaseModel):
    summary: SimulationSummaryOut
    snapshot: SnapshotOut
    days: list[DailyRowOut] = Field(default_factory=list)
    weekly: list[dict[str, Any]] = Field(default_factory=list)
    monthly: list[dict[str, Any]] = Field(default_factory=list)
    quarterly: list[dict[str, Any]] = Field(default_factory=list)
    yearly: list[dict[str, Any]] = Field(default_factory=list)
    read_only: bool = True
    message: str = "Projection only — no real financial records were modified."


class ScenarioCompareRequest(BaseModel):
    scenarios: list[SimulationRunRequest]
