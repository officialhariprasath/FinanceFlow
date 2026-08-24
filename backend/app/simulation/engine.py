"""
Daily chronological lending simulation engine.

Deterministic given the same SimulationSnapshot + SimulationConfig.
Never writes to the real database.
"""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from backend.app.simulation.models import (
    DailySnapshot,
    DayExplain,
    ExistingLoanState,
    LoanProductConfig,
    LoanProjectionStatus,
    ProfitModel,
    RepaymentFrequency,
    SimulationConfig,
    SimulationMode,
    SimulationResult,
    SimulationSnapshot,
    SimulationSummary,
    TargetType,
)
from backend.app.simulation.money import ZERO, floor_div, money
from backend.app.simulation.reinvestment import split_day_cash
from backend.app.simulation.schedule import next_due_after
from backend.app.simulation.target import progress_pct, resolve_target_metric


@dataclass
class _SimLoan:
    loan_id: str
    product_id: str
    principal: Decimal
    installment_amount: Decimal
    installment_principal: Decimal
    installment_profit: Decimal
    frequency: RepaymentFrequency
    custom_interval_days: int
    remaining_installments: int
    next_due_date: date
    status: LoanProjectionStatus
    same_day_collection: bool = False


def _normalize_product(product: LoanProductConfig) -> LoanProductConfig:
    p = deepcopy(product)
    p.principal = money(p.principal)
    p.installment_amount = money(p.installment_amount)
    p.installment_principal = money(p.installment_principal)
    p.installment_profit = money(p.installment_profit)

    if p.profit_model == ProfitModel.FIXED_TOTAL and p.fixed_total_profit is not None:
        total_profit = money(p.fixed_total_profit)
        if p.installment_count > 0:
            p.installment_profit = money(total_profit / Decimal(p.installment_count))
            p.installment_principal = money(p.principal / Decimal(p.installment_count))
            p.installment_amount = money(p.installment_principal + p.installment_profit)
    elif p.profit_model == ProfitModel.FIXED_PERCENTAGE and p.profit_percentage is not None:
        total_profit = money(p.principal * money(p.profit_percentage) / Decimal("100"))
        if p.installment_count > 0:
            p.installment_profit = money(total_profit / Decimal(p.installment_count))
            p.installment_principal = money(p.principal / Decimal(p.installment_count))
            p.installment_amount = money(p.installment_principal + p.installment_profit)
    elif p.profit_model in (
        ProfitModel.FIXED_INSTALLMENT,
        ProfitModel.PRINCIPAL_PROFIT_SPLIT,
        ProfitModel.CUSTOM,
    ):
        if p.installment_amount <= ZERO and (
            p.installment_principal > ZERO or p.installment_profit > ZERO
        ):
            p.installment_amount = money(p.installment_principal + p.installment_profit)
        if p.installment_principal <= ZERO and p.installment_count > 0 and p.principal > ZERO:
            # Derive split from total installment if only total given
            if p.installment_profit > ZERO:
                p.installment_principal = money(p.installment_amount - p.installment_profit)
            else:
                p.installment_principal = money(p.principal / Decimal(p.installment_count))
                p.installment_profit = money(p.installment_amount - p.installment_principal)
    return p


def validate_config(config: SimulationConfig) -> list[str]:
    errors: list[str] = []
    if config.simulation_days <= 0:
        errors.append("Simulation duration must be greater than 0.")
    if config.manual_starting_capital < 0 or config.additional_capital < 0:
        errors.append("Capital cannot be negative.")
    if not config.products:
        errors.append("At least one loan product is required.")
    for prod in config.products:
        if money(prod.principal) <= ZERO:
            errors.append(f"Product {prod.product_id}: loan amount must be > 0.")
        if prod.installment_count <= 0:
            errors.append(f"Product {prod.product_id}: duration/installments must be > 0.")
        if money(prod.installment_amount) < ZERO:
            errors.append(f"Product {prod.product_id}: collection cannot be negative.")
    rp = money(config.reinvestment.percentage)
    if rp < 0 or rp > 100:
        errors.append("Reinvestment percentage must be between 0 and 100.")
    wp = money(config.withdrawal.percentage)
    if wp < 0 or wp > 100:
        errors.append("Withdrawal percentage must be between 0 and 100.")
    if money(config.target.target_value) <= ZERO and config.target.target_type != TargetType.CUSTOM:
        errors.append("Target value must be greater than 0.")
    return errors


def _apply_efficiency(amount: Decimal, efficiency_pct: Decimal) -> Decimal:
    return money(amount * money(efficiency_pct) / Decimal("100"))


def _aggregate(
    days: list[DailySnapshot],
    bucket_fn,
) -> list[dict[str, Any]]:
    buckets: dict[Any, list[DailySnapshot]] = defaultdict(list)
    for d in days:
        buckets[bucket_fn(d)].append(d)
    out: list[dict[str, Any]] = []
    for key in sorted(buckets.keys()):
        rows = buckets[key]
        last = rows[-1]
        out.append(
            {
                "key": str(key),
                "start_date": rows[0].date.isoformat(),
                "end_date": last.date.isoformat(),
                "days": len(rows),
                "collection": str(sum((r.collection for r in rows), ZERO)),
                "principal_recovery": str(sum((r.principal_recovery for r in rows), ZERO)),
                "profit": str(sum((r.profit for r in rows), ZERO)),
                "withdrawn_profit": str(sum((r.withdrawn_profit for r in rows), ZERO)),
                "new_loans": sum(r.new_loans for r in rows),
                "capital_deployed": str(sum((r.capital_deployed for r in rows), ZERO)),
                "ending_cash": str(last.ending_cash),
                "active_loans": last.active_loans,
                "outstanding_principal": str(last.outstanding_principal),
                "cumulative_profit": str(last.cumulative_profit),
                "target_progress_pct": str(last.target_progress_pct),
            }
        )
    return out


def run_simulation(
    config: SimulationConfig,
    snapshot: SimulationSnapshot,
) -> SimulationResult:
    errors = validate_config(config)
    if errors:
        raise ValueError("; ".join(errors))

    start = config.start_date or snapshot.snapshot_date
    products = [_normalize_product(p) for p in (config.products or snapshot.products)]
    if not products:
        raise ValueError("No loan products configured.")

    products_by_id = {p.product_id: p for p in products}
    # Prefer higher weight first when deploying
    deploy_order = sorted(products, key=lambda p: (-p.weight, p.product_id))

    cash = money(snapshot.available_cash)
    loans: list[_SimLoan] = []
    loan_seq = 0

    def new_id(prefix: str = "S") -> str:
        nonlocal loan_seq
        loan_seq += 1
        return f"{prefix}{loan_seq}"

    # Seed existing loans (partial lifecycle)
    for ex in snapshot.existing_loans:
        if ex.remaining_installments <= 0:
            continue
        loans.append(
            _SimLoan(
                loan_id=ex.loan_id,
                product_id=ex.product_id,
                principal=money(ex.principal),
                installment_amount=money(ex.installment_amount),
                installment_principal=money(ex.installment_principal),
                installment_profit=money(ex.installment_profit),
                frequency=ex.frequency,
                custom_interval_days=ex.custom_interval_days,
                remaining_installments=ex.remaining_installments,
                next_due_date=ex.next_due_date,
                status=ex.status,
                same_day_collection=ex.same_day_collection,
            )
        )

    def outstanding() -> Decimal:
        return money(
            sum(
                (
                    money(L.installment_principal * Decimal(L.remaining_installments))
                    for L in loans
                    if L.status == LoanProjectionStatus.ACTIVE and L.remaining_installments > 0
                ),
                ZERO,
            )
        )

    def active_count() -> int:
        return sum(
            1
            for L in loans
            if L.status == LoanProjectionStatus.ACTIVE and L.remaining_installments > 0
        )

    idle_pct = money(config.risk.idle_cash_percent)
    if idle_pct < 0:
        idle_pct = money(0)
    if idle_pct > 100:
        idle_pct = money(100)
    # Only the non-idle share of starting cash is earmarked for lending.
    lending_cash = money(cash * (Decimal("100") - idle_pct) / Decimal("100"))

    def deploy_loans(as_of: date, first_due: date | None = None) -> tuple[int, Decimal]:
        nonlocal cash, lending_cash
        created = 0
        deployed = ZERO
        deployable = money(min(cash, lending_cash))
        progressed = True
        while progressed:
            progressed = False
            for prod in deploy_order:
                if floor_div(deployable, prod.principal) <= 0:
                    continue
                due = first_due
                if due is None:
                    if prod.same_day_collection:
                        due = as_of
                    else:
                        due = next_due_after(
                            as_of, prod.frequency, prod.custom_interval_days
                        )
                loans.append(
                    _SimLoan(
                        loan_id=new_id("N"),
                        product_id=prod.product_id,
                        principal=prod.principal,
                        installment_amount=prod.installment_amount,
                        installment_principal=prod.installment_principal,
                        installment_profit=prod.installment_profit,
                        frequency=prod.frequency,
                        custom_interval_days=prod.custom_interval_days,
                        remaining_installments=prod.installment_count,
                        next_due_date=due,
                        status=LoanProjectionStatus.ACTIVE,
                        same_day_collection=prod.same_day_collection,
                    )
                )
                cash = money(cash - prod.principal)
                lending_cash = money(lending_cash - prod.principal)
                deployable = money(deployable - prod.principal)
                deployed = money(deployed + prod.principal)
                created += 1
                progressed = True
        return created, deployed

    # Initial capital deployment for empty portfolios (hypothetical or current with cash)
    if config.deploy_on_start_day:
        # Loans issued "before" day 1 → first due on start_date
        deploy_loans(start - timedelta(days=1), first_due=start)

    cumulative_profit = ZERO
    cumulative_withdrawn = ZERO
    cumulative_collections = ZERO
    calendar_month_profit: dict[str, Decimal] = defaultdict(lambda: ZERO)

    days_out: list[DailySnapshot] = []
    target_hit_day: DailySnapshot | None = None
    max_metric = ZERO
    max_metric_day = 0

    # Target already achieved on day 0?
    pre_day = DailySnapshot(
        date=start,
        day=0,
        starting_cash=cash,
        active_loans=active_count(),
        loans_completing=0,
        collection=ZERO,
        principal_recovery=ZERO,
        profit=ZERO,
        reinvested_amount=ZERO,
        withdrawn_profit=ZERO,
        new_loans=0,
        capital_deployed=ZERO,
        ending_cash=cash,
        outstanding_principal=outstanding(),
        total_portfolio=money(cash + outstanding()),
        cumulative_profit=ZERO,
        cumulative_withdrawn=ZERO,
        cumulative_collections=ZERO,
        daily_profit_x30=ZERO,
        target_metric=ZERO,
        target_progress_pct=ZERO,
        target_reached=False,
    )
    # Rough pre-check using current daily capacity if we have loans due conceptually
    # Skip inventing profit; only mark ACHIEVED_TODAY after day 1 metrics if needed.

    for day_num in range(1, config.simulation_days + 1):
        today = start + timedelta(days=day_num - 1)
        starting_cash = cash
        collection = ZERO
        principal_rec = ZERO
        profit_col = ZERO
        completing = 0

        for L in loans:
            if L.status != LoanProjectionStatus.ACTIVE or L.remaining_installments <= 0:
                continue
            if L.next_due_date != today:
                continue
            collection = money(collection + L.installment_amount)
            principal_rec = money(principal_rec + L.installment_principal)
            profit_col = money(profit_col + L.installment_profit)
            L.remaining_installments -= 1
            if L.remaining_installments <= 0:
                L.status = LoanProjectionStatus.COMPLETED
                completing += 1
            else:
                L.next_due_date = next_due_after(
                    L.next_due_date, L.frequency, L.custom_interval_days
                )

        # Risk: collection efficiency
        collection = _apply_efficiency(collection, config.risk.collection_efficiency)
        principal_rec = _apply_efficiency(principal_rec, config.risk.collection_efficiency)
        profit_col = _apply_efficiency(profit_col, config.risk.collection_efficiency)

        expenses = money(
            config.risk.operating_expense_per_day + config.risk.other_expense_per_day
        )
        if config.risk.agent_commission_percent > 0:
            expenses = money(
                expenses
                + profit_col * money(config.risk.agent_commission_percent) / Decimal("100")
            )

        eligible, withdrawn, retained = split_day_cash(
            principal_recovered=principal_rec,
            profit_collected=profit_col,
            reinvestment=config.reinvestment,
            withdrawal=config.withdrawal,
            day_number=day_num,
        )
        # All non-withdrawn collections stay in business cash; only `eligible`
        # is added to the lending budget for new loans.
        cash = money(starting_cash + principal_rec + profit_col - withdrawn - expenses)
        # Idle % applies to newly eligible lending inflows as well.
        lending_in = money(eligible * (Decimal("100") - idle_pct) / Decimal("100"))
        lending_cash = money(lending_cash + lending_in)

        cumulative_profit = money(cumulative_profit + profit_col - expenses)
        cumulative_withdrawn = money(cumulative_withdrawn + withdrawn)
        cumulative_collections = money(cumulative_collections + collection)
        month_key = f"{today.year:04d}-{today.month:02d}"
        calendar_month_profit[month_key] = money(
            calendar_month_profit[month_key] + profit_col
        )

        new_loans, capital_deployed = deploy_loans(today)
        ending_cash = cash
        act = active_count()
        outst = outstanding()
        portfolio = money(ending_cash + outst)
        daily_x30 = money(profit_col * Decimal("30"))

        snap = DailySnapshot(
            date=today,
            day=day_num,
            starting_cash=starting_cash,
            active_loans=act,
            loans_completing=completing,
            collection=collection,
            principal_recovery=principal_rec,
            profit=profit_col,
            reinvested_amount=eligible,
            withdrawn_profit=withdrawn,
            new_loans=new_loans,
            capital_deployed=capital_deployed,
            ending_cash=ending_cash,
            outstanding_principal=outst,
            total_portfolio=portfolio,
            cumulative_profit=cumulative_profit,
            cumulative_withdrawn=cumulative_withdrawn,
            cumulative_collections=cumulative_collections,
            daily_profit_x30=daily_x30,
            target_metric=ZERO,
            target_progress_pct=ZERO,
            target_reached=False,
            explain=DayExplain(
                starting_cash=starting_cash,
                collections=collection,
                principal_recovery=principal_rec,
                profit=profit_col,
                new_loans=new_loans,
                capital_deployed=capital_deployed,
                withdrawals=withdrawn,
                expenses=expenses,
                ending_cash=ending_cash,
                active_loans_next=act,
                monthly_run_rate=daily_x30,
                notes=[
                    f"Reinvestment mode={config.reinvestment.mode.value} "
                    f"{config.reinvestment.percentage}%",
                    f"Withdrawal start_day={config.withdrawal.start_day} "
                    f"{config.withdrawal.percentage}%",
                ],
            ),
        )
        metric = resolve_target_metric(
            snap,
            config.target,
            calendar_month_profit=calendar_month_profit[month_key],
        )
        snap.target_metric = metric
        snap.target_progress_pct = progress_pct(metric, config.target.target_value)
        if metric >= money(config.target.target_value):
            snap.target_reached = True
            if target_hit_day is None:
                target_hit_day = snap

        if metric > max_metric:
            max_metric = metric
            max_metric_day = day_num

        days_out.append(snap)

        # Early exit once target found? Spec says still can continue for table —
        # keep full horizon for charts; summary uses first hit.

    # Target already reached at day 0 using opening capacity?
    if days_out:
        first = days_out[0]
        if first.target_reached and first.day == 1:
            # If day 1 already meets target, status ACHIEVED if business already there
            pass

    if target_hit_day is None:
        status = "NOT_REACHED"
        t_day = None
        t_date = None
        days_req = None
    elif target_hit_day.day == 1 and money(target_hit_day.target_metric) >= money(
        config.target.target_value
    ):
        # Could be already achieved at start of horizon
        status = "REACHED"
        t_day = target_hit_day.day
        t_date = target_hit_day.date
        days_req = target_hit_day.day
    else:
        status = "REACHED"
        t_day = target_hit_day.day
        t_date = target_hit_day.date
        days_req = target_hit_day.day

    # If first day metric already >= target and simulation started with enough loans,
    # mark ACHIEVED_TODAY when day 1 hits and user might have already been there —
    # Spec: if current already generates target, show ACHIEVED_TODAY with 0 days.
    if (
        target_hit_day
        and target_hit_day.day == 1
        and config.simulation_mode == SimulationMode.CURRENT_BUSINESS
    ):
        status = "ACHIEVED_TODAY"
        days_req = 0

    hit = target_hit_day
    summary = SimulationSummary(
        target_type=config.target.target_type.value,
        target_value=money(config.target.target_value),
        target_status=status,
        target_day=t_day,
        target_date=t_date,
        days_required=days_req,
        active_loans_at_target=hit.active_loans if hit else None,
        daily_collection_at_target=hit.collection if hit else None,
        daily_profit_at_target=hit.profit if hit else None,
        monthly_profit_at_target=hit.daily_profit_x30 if hit else None,
        reinvestment_pct=money(config.reinvestment.percentage),
        owner_withdrawal_at_target=hit.withdrawn_profit if hit else None,
        portfolio_at_target=hit.total_portfolio if hit else None,
        available_cash_at_target=hit.ending_cash if hit else None,
        cumulative_profit_at_target=hit.cumulative_profit if hit else None,
        max_target_metric=max_metric,
        max_target_day=max_metric_day,
        final_day=days_out[-1] if days_out else None,
    )

    return SimulationResult(
        config=config,
        snapshot=snapshot,
        days=days_out,
        summary=summary,
        weekly=_aggregate(days_out, lambda d: d.date.isocalendar()[0:2]),
        monthly=_aggregate(days_out, lambda d: (d.date.year, d.date.month)),
        quarterly=_aggregate(
            days_out, lambda d: (d.date.year, (d.date.month - 1) // 3 + 1)
        ),
        yearly=_aggregate(days_out, lambda d: d.date.year),
    )


def build_reference_config(
    *,
    starting_capital: Decimal = Decimal("100000"),
    simulation_days: int = 365,
    target_monthly: Decimal = Decimal("100000"),
    reinvestment_pct: Decimal = Decimal("100"),
    withdrawal_pct: Decimal = Decimal("0"),
    withdrawal_start_day: int = 0,
    principal: Decimal = Decimal("5000"),
    installment: Decimal = Decimal("120"),
    installment_principal: Decimal = Decimal("100"),
    installment_profit: Decimal = Decimal("20"),
    installment_count: int = 50,
    frequency: RepaymentFrequency = RepaymentFrequency.DAILY,
    start_date: date | None = None,
) -> tuple[SimulationConfig, SimulationSnapshot]:
    """Helper for tests / quick start — values are parameters, not engine constants."""
    from backend.app.simulation.models import (
        ReinvestmentPolicy,
        TargetConfiguration,
        WithdrawalPolicy,
    )

    start = start_date or date(2026, 1, 1)
    product = LoanProductConfig(
        product_id="P1",
        name="Reference product",
        principal=principal,
        installment_amount=installment,
        installment_principal=installment_principal,
        installment_profit=installment_profit,
        installment_count=installment_count,
        frequency=frequency,
        profit_model=ProfitModel.FIXED_INSTALLMENT,
    )
    config = SimulationConfig(
        simulation_mode=SimulationMode.HYPOTHETICAL,
        manual_starting_capital=starting_capital,
        products=[product],
        reinvestment=ReinvestmentPolicy(percentage=reinvestment_pct),
        withdrawal=WithdrawalPolicy(
            percentage=withdrawal_pct, start_day=withdrawal_start_day
        ),
        target=TargetConfiguration(
            target_type=TargetType.MONTHLY_PROFIT, target_value=target_monthly
        ),
        simulation_days=simulation_days,
        start_date=start,
        deploy_on_start_day=True,
        scenario_name="reference",
    )
    snap = SimulationSnapshot(
        snapshot_date=start,
        available_cash=starting_capital,
        outstanding_principal=ZERO,
        active_loan_count=0,
        existing_loans=[],
        products=[product],
    )
    return config, snap
