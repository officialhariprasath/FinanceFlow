"""Edge-case coverage for the lending simulation engine."""

from datetime import date
from decimal import Decimal

from backend.app.simulation.engine import (
    build_reference_config,
    run_simulation,
    validate_config,
)
from backend.app.simulation.models import (
    ExistingLoanState,
    LoanProductConfig,
    LoanProjectionStatus,
    ProfitModel,
    RepaymentFrequency,
    RiskAssumptions,
    SimulationConfig,
    SimulationMode,
    SimulationSnapshot,
    TargetConfiguration,
    TargetType,
)
from backend.app.simulation.money import ZERO, money


def test_zero_capital_no_loans():
    config, snap = build_reference_config(
        starting_capital=Decimal("0"), simulation_days=10
    )
    result = run_simulation(config, snap)
    assert result.days[0].active_loans == 0
    assert result.days[0].collection == money(0)
    assert all(d.new_loans == 0 for d in result.days)


def test_capital_below_loan_amount():
    config, snap = build_reference_config(
        starting_capital=Decimal("4999"), simulation_days=5
    )
    result = run_simulation(config, snap)
    assert result.days[0].active_loans == 0
    assert result.days[0].ending_cash == money(4999)


def test_cash_never_negative():
    config, snap = build_reference_config(simulation_days=90)
    result = run_simulation(config, snap)
    assert all(d.ending_cash >= ZERO for d in result.days)
    assert all(d.starting_cash >= ZERO for d in result.days)


def test_target_not_reached_within_horizon():
    config, snap = build_reference_config(
        target_monthly=Decimal("10000000"), simulation_days=30
    )
    result = run_simulation(config, snap)
    assert result.summary.target_status == "NOT_REACHED"
    assert result.summary.target_day is None
    assert result.summary.max_target_metric > ZERO


def test_impossible_tiny_horizon():
    config, snap = build_reference_config(
        target_monthly=Decimal("100000"), simulation_days=1
    )
    result = run_simulation(config, snap)
    # Day 1 monthly run-rate = 400*30 = 12000 < 100000
    assert result.summary.target_status == "NOT_REACHED"


def test_full_withdrawal_no_reinvest_growth():
    config, snap = build_reference_config(
        reinvestment_pct=Decimal("0"),
        withdrawal_pct=Decimal("100"),
        withdrawal_start_day=0,
        simulation_days=20,
    )
    result = run_simulation(config, snap)
    assert all(d.new_loans == 0 for d in result.days)
    assert sum(d.withdrawn_profit for d in result.days) > ZERO


def test_collection_efficiency_reduces_inflow():
    c100, s100 = build_reference_config(simulation_days=5)
    c90, s90 = build_reference_config(simulation_days=5)
    c90.risk = RiskAssumptions(collection_efficiency=Decimal("90"))
    r100 = run_simulation(c100, s100)
    r90 = run_simulation(c90, s90)
    assert r90.days[0].collection == money(r100.days[0].collection * Decimal("0.9"))
    assert r90.days[0].profit == money(r100.days[0].profit * Decimal("0.9"))


def test_existing_partial_loan_continues_remaining_only():
    start = date(2026, 1, 1)
    product = LoanProductConfig(
        product_id="P1",
        name="Partial",
        principal=Decimal("5000"),
        installment_amount=Decimal("120"),
        installment_principal=Decimal("100"),
        installment_profit=Decimal("20"),
        installment_count=50,
        frequency=RepaymentFrequency.DAILY,
        profit_model=ProfitModel.FIXED_INSTALLMENT,
    )
    config = SimulationConfig(
        simulation_mode=SimulationMode.CURRENT_BUSINESS,
        products=[product],
        simulation_days=25,
        start_date=start,
        deploy_on_start_day=False,
        target=TargetConfiguration(
            target_type=TargetType.CUMULATIVE_PROFIT,
            target_value=Decimal("1000000"),
        ),
    )
    snap = SimulationSnapshot(
        snapshot_date=start,
        available_cash=ZERO,
        outstanding_principal=Decimal("2000"),
        active_loan_count=1,
        existing_loans=[
            ExistingLoanState(
                loan_id="L1",
                product_id="P1",
                principal=Decimal("5000"),
                installment_amount=Decimal("120"),
                installment_principal=Decimal("100"),
                installment_profit=Decimal("20"),
                frequency=RepaymentFrequency.DAILY,
                remaining_installments=20,
                next_due_date=start,
                status=LoanProjectionStatus.ACTIVE,
            )
        ],
        products=[product],
    )
    result = run_simulation(config, snap)
    assert result.days[0].active_loans == 1
    assert result.days[19].loans_completing == 1
    assert result.days[20].active_loans == 0
    assert result.days[20].collection == money(0)


def test_monthly_frequency_collects_on_month_boundaries():
    config, snap = build_reference_config(
        frequency=RepaymentFrequency.MONTHLY,
        installment_count=12,
        simulation_days=40,
    )
    result = run_simulation(config, snap)
    # First due = start date; next = +1 month
    assert result.days[0].collection > ZERO
    # Days between first and second month should be zero collection from that cohort
    # (unless new loans — with slow monthly, day 2 should be 0 new collection from same)
    assert result.days[1].collection == money(0)


def test_validate_rejects_bad_config():
    config, _ = build_reference_config()
    config.simulation_days = 0
    errors = validate_config(config)
    assert errors

    config, _ = build_reference_config()
    config.products[0].principal = Decimal("0")
    errors = validate_config(config)
    assert any("loan amount" in e.lower() for e in errors)

    config, snap = build_reference_config()
    config.products = []
    raised = False
    try:
        run_simulation(config, snap)
    except ValueError:
        raised = True
    assert raised


def test_progress_can_exceed_100():
    config, snap = build_reference_config(
        target_monthly=Decimal("10000"), simulation_days=30
    )
    result = run_simulation(config, snap)
    # Day 1 run-rate 12000 already > 10000
    assert result.days[0].target_progress_pct >= money(100)
    assert result.summary.target_status in ("REACHED", "ACHIEVED_TODAY")


def test_biweekly_and_custom_run():
    for freq, days, interval in (
        (RepaymentFrequency.BI_WEEKLY, 30, 14),
        (RepaymentFrequency.CUSTOM, 20, 3),
    ):
        config, snap = build_reference_config(
            frequency=freq,
            installment_count=8,
            simulation_days=days,
        )
        config.products[0].custom_interval_days = interval
        result = run_simulation(config, snap)
        assert len(result.days) == days
        assert result.days[0].active_loans == 20


def test_idle_cash_blocks_full_deployment():
    config, snap = build_reference_config(
        starting_capital=Decimal("100000"), simulation_days=5
    )
    config.risk = RiskAssumptions(idle_cash_percent=Decimal("50"))
    result = run_simulation(config, snap)
    # Only half of capital deployable initially → 10 loans not 20
    assert result.days[0].active_loans == 10


def test_multi_product_deploys_both():
    config, snap = build_reference_config(
        starting_capital=Decimal("15000"), simulation_days=5
    )
    config.products.append(
        LoanProductConfig(
            product_id="P2",
            name="B",
            principal=Decimal("10000"),
            installment_amount=Decimal("250"),
            installment_principal=Decimal("200"),
            installment_profit=Decimal("50"),
            installment_count=20,
            frequency=RepaymentFrequency.WEEKLY,
            profit_model=ProfitModel.FIXED_INSTALLMENT,
            weight=1,
        )
    )
    result = run_simulation(config, snap)
    # 5000 + 10000 fit once each from 15000
    assert result.days[0].active_loans == 2


if __name__ == "__main__":
    import sys

    # Allow running without pytest installed
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"OK  {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(failed)
