"""
Calendar-day grace tests.

Grace N = free while (today - due_date).days <= N.
Beyond that: fixed penalty on normal dues; last due accumulates (days_late - N) × penalty.
"""

from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

from backend.app.services.payment_allocation_service import allocate_payment_amount
from backend.app.services.penalty_service import (
    compute_installment_payable,
    compute_loan_payables,
    penalty_defaults_from_settings,
)
from backend.app.utils.date_helpers import installment_schedule_date

ZERO = Decimal("0.00")


def _sched(
    index: int,
    *,
    due_start: date,
    frequency: str = "DAILY",
    amount: Decimal = Decimal("120.00"),
    paid: Decimal = ZERO,
    paid_penalty: Decimal = ZERO,
    assessed_penalty: Decimal = ZERO,
    paid_on: date | None = None,
    schedule_id: int | None = None,
):
    schedule_date = installment_schedule_date(due_start, frequency, index)
    return SimpleNamespace(
        id=schedule_id if schedule_id is not None else index + 1,
        schedule_date=schedule_date,
        expected_amount=amount,
        expected_principal=amount,
        expected_profit=ZERO,
        paid_amount=paid,
        paid_principal=paid,
        paid_profit=ZERO,
        paid_penalty=paid_penalty,
        assessed_penalty=assessed_penalty,
        paid_on=paid_on,
        status="PENDING",
    )


def _build_loan_schedules(
    count: int,
    *,
    due_start: date,
    frequency: str = "DAILY",
    amount: Decimal = Decimal("120.00"),
):
    return [
        _sched(i, due_start=due_start, frequency=frequency, amount=amount)
        for i in range(count)
    ]


def _payable_map(schedules, *, grace: int, penalty: Decimal, as_of: date):
    return compute_loan_payables(
        schedules,
        grace_installments=grace,
        penalty_per_installment=penalty,
        as_of=as_of,
    )


DUE_START = date(2026, 1, 1)
GRACE = 3
PENALTY = Decimal("10.00")
AMT = Decimal("120.00")


def test_day1_current_no_penalty():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=DUE_START)
    assert payables[schedules[0].id].total_payable == AMT
    assert payables[schedules[0].id].penalty_outstanding == ZERO


def test_within_calendar_grace_no_penalty():
    """Due dates with days_late <= grace stay free."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=3)  # days_late for day1 = 3
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    for sched in schedules:
        if sched.schedule_date >= as_of:
            continue
        assert payables[sched.id].penalty_outstanding == ZERO
        assert payables[sched.id].within_grace is True


def test_day_outside_calendar_grace_gets_fixed_penalty():
    """days_late = 4 with grace=3 → first day penalized once."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[0].id].within_grace is False
    # days_late 3,2,1 still free
    for i in (1, 2, 3):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].within_grace is True
    assert payables[schedules[4].id].total_payable == AMT  # today


def test_user_screenshot_case_nov9_grace5():
    """
    Last due 7 Nov, today 9 Nov, grace 5.
    Nov 3 is 6 days late → penalty; Nov 4–7 still within 5 days → grace.
    """
    due_start = date(2026, 11, 3)
    schedules = _build_loan_schedules(5, due_start=due_start, amount=Decimal("240.00"))
    as_of = date(2026, 11, 9)
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert schedules[0].schedule_date == date(2026, 11, 3)
    assert schedules[-1].schedule_date == date(2026, 11, 7)
    assert payables[schedules[0].id].penalty_outstanding == Decimal("50.00")
    assert payables[schedules[0].id].total_payable == Decimal("290.00")
    for i in range(1, 5):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].within_grace is True
        assert payables[schedules[i].id].total_payable == Decimal("240.00")


def test_post_maturity_accumulates_on_last_due():
    """
    Last due 7 Nov, unpaid until 20 Nov, grace 5, penalty ₹50.
    Nov 7 days_late=13 → (13-5)×50 = ₹400 on the last due.
    Older dues each get fixed ₹50 once.
    """
    due_start = date(2026, 11, 3)
    schedules = _build_loan_schedules(5, due_start=due_start, amount=Decimal("240.00"))
    as_of = date(2026, 11, 20)
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    # Nov 3–6: fixed once
    for i in range(4):
        assert payables[schedules[i].id].penalty_outstanding == Decimal("50.00")
        assert payables[schedules[i].id].total_payable == Decimal("290.00")
    # Nov 7 last due: accumulates
    assert payables[schedules[4].id].penalty_outstanding == Decimal("400.00")
    assert payables[schedules[4].id].total_payable == Decimal("640.00")


def test_last_due_grows_each_day_past_grace():
    due_start = date(2026, 11, 1)
    schedules = _build_loan_schedules(1, due_start=due_start, amount=AMT)
    # days_late=5 → still grace
    as_of = date(2026, 11, 6)
    p1 = _payable_map(schedules, grace=5, penalty=PENALTY, as_of=as_of)
    assert p1[schedules[0].id].penalty_outstanding == ZERO
    # days_late=6 → 1 unit
    as_of2 = date(2026, 11, 7)
    p2 = _payable_map(schedules, grace=5, penalty=PENALTY, as_of=as_of2)
    assert p2[schedules[0].id].penalty_outstanding == PENALTY
    # days_late=8 → 3 units
    as_of3 = date(2026, 11, 9)
    p3 = _payable_map(schedules, grace=5, penalty=PENALTY, as_of=as_of3)
    assert p3[schedules[0].id].penalty_outstanding == Decimal("30.00")


def test_paid_row_keeps_assessed_penalty_visible():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    day1 = schedules[0]
    before = compute_installment_payable(
        day1,
        ordered_schedules=schedules,
        grace_installments=GRACE,
        penalty_per_installment=PENALTY,
        as_of=as_of,
    )
    assert before.total_payable == Decimal("130.00")
    day1.paid_amount = AMT
    day1.paid_principal = AMT
    day1.paid_penalty = PENALTY
    day1.assessed_penalty = PENALTY
    day1.paid_on = as_of
    day1.status = "PAID"
    after = compute_installment_payable(
        day1,
        ordered_schedules=schedules,
        grace_installments=GRACE,
        penalty_per_installment=PENALTY,
        as_of=as_of,
    )
    assert after.total_payable == ZERO
    assert after.penalty_amount == PENALTY
    assert after.paid_penalty == PENALTY


def test_payment_allocation_clears_penalty():
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("130.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == AMT
    assert profit == ZERO
    assert penalty == PENALTY


def test_partial_payment_leaves_remaining():
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == Decimal("50.00")
    assert (AMT - principal) + (PENALTY - penalty) == Decimal("80.00")


def test_weekly_calendar_grace():
    due_start = date(2026, 1, 5)
    schedules = _build_loan_schedules(
        4, due_start=due_start, frequency="WEEKLY", amount=AMT
    )
    # as_of = 3rd weekly due; first due is 14 days late
    as_of = schedules[2].schedule_date
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    # first due: 14 days late > 5 → fixed (not last)
    assert payables[schedules[0].id].penalty_outstanding == Decimal("50.00")
    # second: 7 days late > 5 → fixed
    assert payables[schedules[1].id].penalty_outstanding == Decimal("50.00")
    # third is today / last among overdue-or-today — if last overall and days_late=0
    assert payables[schedules[2].id].penalty_outstanding == ZERO


def test_zero_config_never_penalizes():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=20)
    payables = _payable_map(schedules, grace=0, penalty=ZERO, as_of=as_of)
    for sched in schedules:
        if sched.schedule_date < as_of:
            assert payables[sched.id].penalty_outstanding == ZERO


def test_grace_zero_all_overdue_penalized():
    schedules = _build_loan_schedules(5, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=1)
    payables = _payable_map(schedules, grace=0, penalty=PENALTY, as_of=as_of)
    # day1 is last? no - 5 schedules, day1 is overdue 1 day, not last
    # last is day5 which is future. day1 days_late=1 > 0 → fixed
    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[1].id].total_payable == AMT


def test_settings_defaults_helper():
    settings = SimpleNamespace(
        daily_grace_installments=5,
        daily_penalty_per_installment=Decimal("50.00"),
        weekly_grace_installments=1,
        weekly_penalty_per_installment=Decimal("50.00"),
        bi_weekly_grace_installments=1,
        bi_weekly_penalty_per_installment=Decimal("100.00"),
        monthly_grace_installments=1,
        monthly_penalty_per_installment=Decimal("200.00"),
    )
    assert penalty_defaults_from_settings(settings, "DAILY") == (5, Decimal("50.00"))


def test_settings_change_grace_5_to_3_recalculates_by_calendar():
    from backend.app.services.penalty_service import effective_penalty_config

    due_start = date(2026, 11, 3)
    schedules = _build_loan_schedules(5, due_start=due_start, amount=AMT)
    as_of = date(2026, 11, 9)
    with_grace5 = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert with_grace5[schedules[0].id].penalty_outstanding == Decimal("50.00")
    assert with_grace5[schedules[1].id].penalty_outstanding == ZERO

    with_grace3 = _payable_map(
        schedules, grace=3, penalty=Decimal("50.00"), as_of=as_of
    )
    # Nov 3 days_late=6, Nov 4=5, Nov 5=4 → with grace 3: Nov3,4,5 penalized?
    # Nov 3: 6>3 fixed, Nov 4: 5>3 fixed, Nov 5: 4>3 fixed, Nov 6: 3<=3 grace, Nov 7: 2 grace last
    assert with_grace3[schedules[0].id].penalty_outstanding == Decimal("50.00")
    assert with_grace3[schedules[1].id].penalty_outstanding == Decimal("50.00")
    assert with_grace3[schedules[2].id].penalty_outstanding == Decimal("50.00")
    assert with_grace3[schedules[3].id].penalty_outstanding == ZERO
    assert with_grace3[schedules[4].id].penalty_outstanding == ZERO

    loan = SimpleNamespace(
        collection_model="DAILY_COLLECTION",
        collection_frequency="DAILY",
        grace_installments=5,
        penalty_per_installment=Decimal("50.00"),
    )
    settings = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=Decimal("50.00"),
        weekly_grace_installments=0,
        weekly_penalty_per_installment=ZERO,
        bi_weekly_grace_installments=0,
        bi_weekly_penalty_per_installment=ZERO,
        monthly_grace_installments=0,
        monthly_penalty_per_installment=ZERO,
    )
    assert effective_penalty_config(loan, settings) == (3, Decimal("50.00"))


def test_biweekly_and_monthly_use_calendar_days():
    due_start = date(2026, 1, 1)
    bi = _build_loan_schedules(3, due_start=due_start, frequency="BI_WEEKLY", amount=AMT)
    as_of = bi[1].schedule_date  # 14 days after first
    payables = _payable_map(bi, grace=5, penalty=Decimal("100.00"), as_of=as_of)
    assert payables[bi[0].id].penalty_outstanding == Decimal("100.00")

    monthly = _build_loan_schedules(3, due_start=due_start, frequency="MONTHLY", amount=AMT)
    as_of_m = monthly[1].schedule_date
    payables_m = _payable_map(
        monthly, grace=5, penalty=Decimal("200.00"), as_of=as_of_m
    )
    assert payables_m[monthly[0].id].penalty_outstanding == Decimal("200.00")


def test_penalty_never_mutates_original_amount():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=20)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].original_amount == AMT
