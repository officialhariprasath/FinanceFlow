"""Configuration-driven simulation domain models (no hardcoded business values)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Any


class SimulationMode(str, Enum):
    CURRENT_BUSINESS = "CURRENT_BUSINESS"
    HYPOTHETICAL = "HYPOTHETICAL"


class CapitalSource(str, Enum):
    CURRENT = "CURRENT"
    MANUAL = "MANUAL"
    CURRENT_PLUS_ADDITIONAL = "CURRENT_PLUS_ADDITIONAL"
    CUSTOM = "CUSTOM"


class RepaymentFrequency(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BI_WEEKLY = "BI_WEEKLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


class ProfitModel(str, Enum):
    FIXED_TOTAL = "FIXED_TOTAL"
    FIXED_PERCENTAGE = "FIXED_PERCENTAGE"
    FIXED_INSTALLMENT = "FIXED_INSTALLMENT"
    PRINCIPAL_PROFIT_SPLIT = "PRINCIPAL_PROFIT_SPLIT"
    CUSTOM = "CUSTOM"


class ReinvestmentMode(str, Enum):
    """How reinvestment % is applied to eligible cash."""

    TOTAL_ELIGIBLE_CASH = "TOTAL_ELIGIBLE_CASH"
    FULL_PRINCIPAL_PLUS_PROFIT_PCT = "FULL_PRINCIPAL_PLUS_PROFIT_PCT"
    PCT_OF_BOTH = "PCT_OF_BOTH"


class TargetType(str, Enum):
    MONTHLY_PROFIT = "MONTHLY_PROFIT"
    DAILY_PROFIT = "DAILY_PROFIT"
    WEEKLY_PROFIT = "WEEKLY_PROFIT"
    ANNUAL_PROFIT = "ANNUAL_PROFIT"
    OWNER_WITHDRAWAL = "OWNER_WITHDRAWAL"
    LENDING_CAPITAL = "LENDING_CAPITAL"
    ACTIVE_LOAN_COUNT = "ACTIVE_LOAN_COUNT"
    TOTAL_PORTFOLIO = "TOTAL_PORTFOLIO"
    TOTAL_COLLECTIONS = "TOTAL_COLLECTIONS"
    CUMULATIVE_PROFIT = "CUMULATIVE_PROFIT"
    CUSTOM = "CUSTOM"


class MonthlyProfitMethod(str, Enum):
    RUN_RATE_X30 = "RUN_RATE_X30"
    CALENDAR_MONTH = "CALENDAR_MONTH"


class LoanProjectionStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    OVERDUE = "OVERDUE"
    COMPLETED = "COMPLETED"
    DEFAULTED = "DEFAULTED"
    CANCELLED = "CANCELLED"


class RiskPreset(str, Enum):
    OPTIMISTIC = "OPTIMISTIC"
    BASE = "BASE"
    CONSERVATIVE = "CONSERVATIVE"
    CUSTOM = "CUSTOM"


@dataclass
class LoanProductConfig:
    product_id: str
    name: str = ""
    principal: Decimal = Decimal("0")
    installment_amount: Decimal = Decimal("0")
    installment_principal: Decimal = Decimal("0")
    installment_profit: Decimal = Decimal("0")
    installment_count: int = 0
    frequency: RepaymentFrequency = RepaymentFrequency.DAILY
    custom_interval_days: int = 1
    profit_model: ProfitModel = ProfitModel.FIXED_INSTALLMENT
    fixed_total_profit: Decimal | None = None
    profit_percentage: Decimal | None = None
    same_day_collection: bool = False
    weight: int = 1  # relative priority when deploying capital across products


@dataclass
class ReinvestmentPolicy:
    percentage: Decimal = Decimal("100")
    mode: ReinvestmentMode = ReinvestmentMode.TOTAL_ELIGIBLE_CASH


@dataclass
class WithdrawalPolicy:
    percentage: Decimal = Decimal("0")
    start_day: int = 0
    frequency: RepaymentFrequency = RepaymentFrequency.DAILY
    custom_interval_days: int = 1


@dataclass
class TargetConfiguration:
    target_type: TargetType = TargetType.MONTHLY_PROFIT
    target_value: Decimal = Decimal("0")
    monthly_method: MonthlyProfitMethod = MonthlyProfitMethod.RUN_RATE_X30


@dataclass
class RiskAssumptions:
    preset: RiskPreset = RiskPreset.OPTIMISTIC
    collection_efficiency: Decimal = Decimal("100")  # percent
    default_rate: Decimal = Decimal("0")  # percent of active loans (unused unless enabled)
    delayed_payment_rate: Decimal = Decimal("0")
    idle_cash_percent: Decimal = Decimal("0")
    operating_expense_per_day: Decimal = Decimal("0")
    other_expense_per_day: Decimal = Decimal("0")
    agent_commission_percent: Decimal = Decimal("0")


@dataclass
class ExistingLoanState:
    """Partially completed loan carried into CURRENT_BUSINESS simulation."""

    loan_id: str
    product_id: str
    principal: Decimal
    installment_amount: Decimal
    installment_principal: Decimal
    installment_profit: Decimal
    frequency: RepaymentFrequency
    remaining_installments: int
    next_due_date: date
    custom_interval_days: int = 1
    status: LoanProjectionStatus = LoanProjectionStatus.ACTIVE
    same_day_collection: bool = False


@dataclass
class SimulationSnapshot:
    snapshot_date: date
    available_cash: Decimal
    outstanding_principal: Decimal
    active_loan_count: int
    existing_loans: list[ExistingLoanState] = field(default_factory=list)
    products: list[LoanProductConfig] = field(default_factory=list)
    currency: str = "INR"
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationConfig:
    simulation_mode: SimulationMode = SimulationMode.HYPOTHETICAL
    capital_source: CapitalSource = CapitalSource.MANUAL
    manual_starting_capital: Decimal = Decimal("0")
    additional_capital: Decimal = Decimal("0")
    products: list[LoanProductConfig] = field(default_factory=list)
    reinvestment: ReinvestmentPolicy = field(default_factory=ReinvestmentPolicy)
    withdrawal: WithdrawalPolicy = field(default_factory=WithdrawalPolicy)
    target: TargetConfiguration = field(default_factory=TargetConfiguration)
    simulation_days: int = 365
    start_date: date | None = None
    risk: RiskAssumptions = field(default_factory=RiskAssumptions)
    deploy_on_start_day: bool = True
    scenario_name: str = ""


@dataclass
class DayExplain:
    starting_cash: Decimal
    collections: Decimal
    principal_recovery: Decimal
    profit: Decimal
    new_loans: int
    capital_deployed: Decimal
    withdrawals: Decimal
    expenses: Decimal
    ending_cash: Decimal
    active_loans_next: int
    monthly_run_rate: Decimal
    notes: list[str] = field(default_factory=list)


@dataclass
class DailySnapshot:
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
    cumulative_withdrawn: Decimal
    cumulative_collections: Decimal
    daily_profit_x30: Decimal
    target_metric: Decimal
    target_progress_pct: Decimal
    target_reached: bool
    explain: DayExplain | None = None


@dataclass
class SimulationSummary:
    target_type: str
    target_value: Decimal
    target_status: str  # ACHIEVED_TODAY | REACHED | NOT_REACHED
    target_day: int | None
    target_date: date | None
    days_required: int | None
    active_loans_at_target: int | None
    daily_collection_at_target: Decimal | None
    daily_profit_at_target: Decimal | None
    monthly_profit_at_target: Decimal | None
    reinvestment_pct: Decimal
    owner_withdrawal_at_target: Decimal | None
    portfolio_at_target: Decimal | None
    available_cash_at_target: Decimal | None
    cumulative_profit_at_target: Decimal | None
    max_target_metric: Decimal
    max_target_day: int
    final_day: DailySnapshot | None


@dataclass
class SimulationResult:
    config: SimulationConfig
    snapshot: SimulationSnapshot
    days: list[DailySnapshot]
    summary: SimulationSummary
    weekly: list[dict[str, Any]] = field(default_factory=list)
    monthly: list[dict[str, Any]] = field(default_factory=list)
    quarterly: list[dict[str, Any]] = field(default_factory=list)
    yearly: list[dict[str, Any]] = field(default_factory=list)
