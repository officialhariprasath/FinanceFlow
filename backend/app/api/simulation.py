"""
Read-only Dynamic Lending Simulation API.

POST /simulation/run — projects future cash/loans/profit; never mutates ledger.
GET  /simulation/snapshot — current business snapshot for Mode A.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.auth_context import get_current_finance_owner
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.simulation import (
    DailyRowOut,
    SimulationRunRequest,
    SimulationRunResponse,
    SimulationSummaryOut,
    SnapshotOut,
    ScenarioCompareRequest,
)
from backend.app.simulation.engine import run_simulation
from backend.app.simulation.models import (
    CapitalSource,
    LoanProductConfig,
    MonthlyProfitMethod,
    ProfitModel,
    ReinvestmentMode,
    ReinvestmentPolicy,
    RepaymentFrequency,
    RiskAssumptions,
    RiskPreset,
    SimulationConfig,
    SimulationMode,
    SimulationSnapshot,
    TargetConfiguration,
    TargetType,
    WithdrawalPolicy,
)
from backend.app.simulation.money import money
from backend.app.simulation.snapshot import build_business_snapshot, resolve_starting_cash

router = APIRouter(prefix="/simulation", tags=["Simulation"])


def _enum(enum_cls, value: str, default):
    try:
        return enum_cls(value)
    except ValueError:
        return default


def _product_from_in(p) -> LoanProductConfig:
    return LoanProductConfig(
        product_id=p.product_id,
        name=p.name or p.product_id,
        principal=money(p.principal),
        installment_amount=money(p.installment_amount),
        installment_principal=money(p.installment_principal),
        installment_profit=money(p.installment_profit),
        installment_count=p.installment_count,
        frequency=_enum(RepaymentFrequency, p.frequency, RepaymentFrequency.DAILY),
        custom_interval_days=p.custom_interval_days,
        profit_model=_enum(ProfitModel, p.profit_model, ProfitModel.FIXED_INSTALLMENT),
        fixed_total_profit=money(p.fixed_total_profit) if p.fixed_total_profit is not None else None,
        profit_percentage=money(p.profit_percentage) if p.profit_percentage is not None else None,
        same_day_collection=p.same_day_collection,
        weight=p.weight,
    )


def _config_from_request(body: SimulationRunRequest) -> SimulationConfig:
    products = [_product_from_in(p) for p in body.products]
    return SimulationConfig(
        simulation_mode=_enum(SimulationMode, body.simulation_mode, SimulationMode.HYPOTHETICAL),
        capital_source=_enum(CapitalSource, body.capital_source, CapitalSource.MANUAL),
        manual_starting_capital=money(body.manual_starting_capital),
        additional_capital=money(body.additional_capital),
        products=products,
        reinvestment=ReinvestmentPolicy(
            percentage=money(body.reinvestment.percentage),
            mode=_enum(
                ReinvestmentMode,
                body.reinvestment.mode,
                ReinvestmentMode.TOTAL_ELIGIBLE_CASH,
            ),
        ),
        withdrawal=WithdrawalPolicy(
            percentage=money(body.withdrawal.percentage),
            start_day=body.withdrawal.start_day,
            frequency=_enum(
                RepaymentFrequency, body.withdrawal.frequency, RepaymentFrequency.DAILY
            ),
            custom_interval_days=body.withdrawal.custom_interval_days,
        ),
        target=TargetConfiguration(
            target_type=_enum(TargetType, body.target.target_type, TargetType.MONTHLY_PROFIT),
            target_value=money(body.target.target_value),
            monthly_method=_enum(
                MonthlyProfitMethod,
                body.target.monthly_method,
                MonthlyProfitMethod.RUN_RATE_X30,
            ),
        ),
        simulation_days=body.simulation_days,
        start_date=body.start_date,
        risk=RiskAssumptions(
            preset=_enum(RiskPreset, body.risk.preset, RiskPreset.OPTIMISTIC),
            collection_efficiency=money(body.risk.collection_efficiency),
            default_rate=money(body.risk.default_rate),
            delayed_payment_rate=money(body.risk.delayed_payment_rate),
            idle_cash_percent=money(body.risk.idle_cash_percent),
            operating_expense_per_day=money(body.risk.operating_expense_per_day),
            other_expense_per_day=money(body.risk.other_expense_per_day),
            agent_commission_percent=money(body.risk.agent_commission_percent),
        ),
        deploy_on_start_day=body.deploy_on_start_day,
        scenario_name=body.scenario_name,
    )


def _serialize_result(result, body: SimulationRunRequest) -> SimulationRunResponse:
    s = result.summary
    days = result.days
    if body.include_daily and body.max_daily_rows > 0:
        days = days[: body.max_daily_rows]

    daily_rows: list[DailyRowOut] = []
    if body.include_daily:
        for d in days:
            explain = None
            if d.explain:
                explain = {
                    "starting_cash": str(d.explain.starting_cash),
                    "collections": str(d.explain.collections),
                    "principal_recovery": str(d.explain.principal_recovery),
                    "profit": str(d.explain.profit),
                    "new_loans": d.explain.new_loans,
                    "capital_deployed": str(d.explain.capital_deployed),
                    "withdrawals": str(d.explain.withdrawals),
                    "expenses": str(d.explain.expenses),
                    "ending_cash": str(d.explain.ending_cash),
                    "active_loans_next": d.explain.active_loans_next,
                    "monthly_run_rate": str(d.explain.monthly_run_rate),
                    "notes": d.explain.notes,
                }
            daily_rows.append(
                DailyRowOut(
                    date=d.date,
                    day=d.day,
                    starting_cash=d.starting_cash,
                    active_loans=d.active_loans,
                    loans_completing=d.loans_completing,
                    collection=d.collection,
                    principal_recovery=d.principal_recovery,
                    profit=d.profit,
                    reinvested_amount=d.reinvested_amount,
                    withdrawn_profit=d.withdrawn_profit,
                    new_loans=d.new_loans,
                    capital_deployed=d.capital_deployed,
                    ending_cash=d.ending_cash,
                    outstanding_principal=d.outstanding_principal,
                    total_portfolio=d.total_portfolio,
                    cumulative_profit=d.cumulative_profit,
                    daily_profit_x30=d.daily_profit_x30,
                    target_metric=d.target_metric,
                    target_progress_pct=d.target_progress_pct,
                    target_reached=d.target_reached,
                    explain=explain,
                )
            )

    snap = result.snapshot
    return SimulationRunResponse(
        summary=SimulationSummaryOut(
            target_type=s.target_type,
            target_value=s.target_value,
            target_status=s.target_status,
            target_day=s.target_day,
            target_date=s.target_date,
            days_required=s.days_required,
            active_loans_at_target=s.active_loans_at_target,
            daily_collection_at_target=s.daily_collection_at_target,
            daily_profit_at_target=s.daily_profit_at_target,
            monthly_profit_at_target=s.monthly_profit_at_target,
            reinvestment_pct=s.reinvestment_pct,
            owner_withdrawal_at_target=s.owner_withdrawal_at_target,
            portfolio_at_target=s.portfolio_at_target,
            available_cash_at_target=s.available_cash_at_target,
            cumulative_profit_at_target=s.cumulative_profit_at_target,
            max_target_metric=s.max_target_metric,
            max_target_day=s.max_target_day,
        ),
        snapshot=SnapshotOut(
            snapshot_date=snap.snapshot_date,
            available_cash=snap.available_cash,
            outstanding_principal=snap.outstanding_principal,
            active_loan_count=snap.active_loan_count,
            currency=snap.currency,
            products=[
                {
                    "product_id": p.product_id,
                    "name": p.name,
                    "principal": str(p.principal),
                    "installment_amount": str(p.installment_amount),
                    "frequency": p.frequency.value,
                    "installment_count": p.installment_count,
                }
                for p in snap.products
            ],
            meta=snap.meta,
        ),
        days=daily_rows,
        weekly=result.weekly if body.include_aggregates else [],
        monthly=result.monthly if body.include_aggregates else [],
        quarterly=result.quarterly if body.include_aggregates else [],
        yearly=result.yearly if body.include_aggregates else [],
    )


@router.get("/snapshot", response_model=SnapshotOut)
def get_snapshot(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    try:
        snap = build_business_snapshot(db, owner.id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Could not build business snapshot: {exc}",
        ) from exc
    return SnapshotOut(
        snapshot_date=snap.snapshot_date,
        available_cash=snap.available_cash,
        outstanding_principal=snap.outstanding_principal,
        active_loan_count=snap.active_loan_count,
        currency=snap.currency,
        products=[
            {
                "product_id": p.product_id,
                "name": p.name,
                "principal": str(p.principal),
                "installment_amount": str(p.installment_amount),
                "installment_principal": str(p.installment_principal),
                "installment_profit": str(p.installment_profit),
                "frequency": p.frequency.value,
                "installment_count": p.installment_count,
            }
            for p in snap.products
        ],
        meta=snap.meta,
    )


@router.post("/run", response_model=SimulationRunResponse)
def run_sim(
    body: SimulationRunRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    config = _config_from_request(body)
    mode = config.simulation_mode

    if mode == SimulationMode.CURRENT_BUSINESS:
        live = build_business_snapshot(db, owner.id, as_of=body.start_date or date.today())
        starting = resolve_starting_cash(
            capital_source=body.capital_source,
            snapshot=live,
            manual=money(body.manual_starting_capital),
            additional=money(body.additional_capital),
        )
        products = config.products or live.products
        if not products:
            raise HTTPException(
                status_code=400,
                detail="No loan products found. Add a product for new-loan deployment.",
            )
        config.products = products
        snapshot = SimulationSnapshot(
            snapshot_date=live.snapshot_date,
            available_cash=starting,
            outstanding_principal=live.outstanding_principal,
            active_loan_count=live.active_loan_count,
            existing_loans=live.existing_loans,
            products=products,
            currency=live.currency,
            meta=live.meta,
        )
        # Keep existing loans; still allow deploying leftover cash on start
        config.start_date = body.start_date or live.snapshot_date
    else:
        starting = resolve_starting_cash(
            capital_source=body.capital_source
            if body.capital_source != "CURRENT"
            else "MANUAL",
            snapshot=SimulationSnapshot(
                snapshot_date=body.start_date or date.today(),
                available_cash=money(body.manual_starting_capital),
                outstanding_principal=Decimal("0"),
                active_loan_count=0,
            ),
            manual=money(body.manual_starting_capital),
            additional=money(body.additional_capital),
        )
        if not config.products:
            raise HTTPException(status_code=400, detail="At least one loan product is required.")
        snapshot = SimulationSnapshot(
            snapshot_date=body.start_date or date.today(),
            available_cash=starting,
            outstanding_principal=Decimal("0"),
            active_loan_count=0,
            existing_loans=[],
            products=config.products,
        )
        config.start_date = snapshot.snapshot_date

    try:
        result = run_simulation(config, snapshot)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _serialize_result(result, body)


@router.post("/compare")
def compare_scenarios(
    body: ScenarioCompareRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    if len(body.scenarios) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two scenarios.")
    if len(body.scenarios) > 5:
        raise HTTPException(status_code=400, detail="Compare at most 5 scenarios.")

    results = []
    for sc in body.scenarios:
        # Reuse run endpoint logic lightly
        resp = run_sim(sc, db, owner)
        results.append(
            {
                "name": sc.scenario_name or sc.simulation_mode,
                "summary": resp.summary.model_dump(),
            }
        )
    return {"read_only": True, "scenarios": results}
