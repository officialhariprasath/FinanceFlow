"""
Grace-installment fixed-penalty engine tests.

Covers the Day 1–Day 6 daily scenario, weekly/bi-weekly/monthly sequence
aging, payment clearing, partial payment, and no compounding.
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
TWOPLACES = Decimal("0.01")


def _sched(
    index: int,
    *,
    due_start: date,
    frequency: str = "DAILY",
    amount: Decimal = Decimal("120.00"),
    paid: Decimal = ZERO,
    paid_penalty: Decimal = ZERO,
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


def _totals(payables):
    """Return list of (date, total_payable, penalty_outstanding) ordered by date."""
    rows = sorted(payables.values(), key=lambda p: p.schedule_date)
    return [
        (p.schedule_date, p.total_payable, p.penalty_outstanding, p.original_amount)
        for p in rows
    ]


# ---------------------------------------------------------------------------
# Day 1–6 scenario (Daily, grace=3, penalty=10, installment=120)
# ---------------------------------------------------------------------------

DUE_START = date(2026, 1, 1)
GRACE = 3
PENALTY = Decimal("10.00")
AMT = Decimal("120.00")


def test_day1_missed_no_penalty():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START  # Day 1
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    day1 = payables[schedules[0].id]
    assert day1.total_payable == AMT
    assert day1.penalty_outstanding == ZERO
    assert day1.grace_crossed is False


def test_day2_to_day4_still_within_grace():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    for day_offset in (1, 2, 3):  # Days 2, 3, 4
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        for sched in schedules:
            if sched.schedule_date > as_of:
                continue
            p = payables[sched.id]
            if sched.schedule_date == as_of:
                assert p.total_payable == AMT
                assert p.penalty_outstanding == ZERO
            else:
                # Missed prior installments still within grace
                assert p.penalty_outstanding == ZERO
                assert p.total_payable == AMT


def test_day4_no_penalty_on_any_installment():
    """Test 2 — grace period: through Day 4, no penalties."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=3)  # Day 4
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    for sched in schedules[:4]:
        assert payables[sched.id].penalty_outstanding == ZERO
        assert payables[sched.id].total_payable == AMT


def test_day5_first_penalty_on_day1_current_untouched():
    """
    Test 3 — first penalty on Day 5.

    Sequence aging: Day 1 has elapsed 4 > grace 3 → ₹130.
    Day 5 (current) remains ₹120.
    """
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)  # Day 5
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)

    day1 = payables[schedules[0].id]
    day2 = payables[schedules[1].id]
    day3 = payables[schedules[2].id]
    day4 = payables[schedules[3].id]
    day5 = payables[schedules[4].id]

    assert day1.original_amount == AMT
    assert day1.penalty_outstanding == PENALTY
    assert day1.total_payable == Decimal("130.00")
    assert day1.grace_crossed is True

    assert day2.penalty_outstanding == ZERO
    assert day3.penalty_outstanding == ZERO
    assert day4.penalty_outstanding == ZERO

    assert day5.total_payable == AMT
    assert day5.penalty_outstanding == ZERO
    assert day5.installments_elapsed == 0  # current never gets early penalty


def test_day6_multiple_penalties():
    """Test 4 — Day 1 and Day 2 penalized; Day 6 current stays ₹120."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=5)  # Day 6
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)

    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[1].id].total_payable == Decimal("130.00")
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[5].id].total_payable == AMT  # Day 6 current


def test_no_overdue_when_day1_paid():
    """Test 1 — Day 1 paid, Day 2 current → no penalty."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    schedules[0].paid_amount = AMT
    schedules[0].paid_principal = AMT
    as_of = DUE_START + timedelta(days=1)  # Day 2
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == ZERO
    assert payables[schedules[1].id].total_payable == AMT
    assert payables[schedules[1].id].penalty_outstanding == ZERO


def test_penalty_never_compounds():
    """Test 10 — unpaid penalized installment stays ₹130, not growing."""
    schedules = _build_loan_schedules(20, due_start=DUE_START)
    for day_offset in range(4, 15):
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        day1 = payables[schedules[0].id]
        assert day1.total_payable == Decimal("130.00")
        assert day1.penalty_amount == PENALTY
        assert day1.original_amount == AMT


def test_payment_clears_penalty():
    """Test 5 — paying ₹130 clears installment + penalty."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)  # Day 5 — Day 1 is ₹130
    day1 = schedules[0]
    payable = compute_installment_payable(
        day1,
        ordered_schedules=schedules,
        grace_installments=GRACE,
        penalty_per_installment=PENALTY,
        as_of=as_of,
    )
    assert payable.total_payable == Decimal("130.00")

    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("130.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == AMT
    assert profit == ZERO
    assert penalty == PENALTY

    day1.paid_amount = principal + profit
    day1.paid_principal = principal
    day1.paid_penalty = penalty
    after = compute_installment_payable(
        day1,
        ordered_schedules=schedules,
        grace_installments=GRACE,
        penalty_per_installment=PENALTY,
        as_of=as_of,
    )
    assert after.total_payable == ZERO
    assert after.installment_outstanding == ZERO
    assert after.penalty_outstanding == ZERO


def test_partial_payment_leaves_remaining():
    """Test 6 — ₹50 against ₹130 leaves ₹80 (profit→principal→penalty)."""
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == Decimal("50.00")
    assert profit == ZERO
    assert penalty == ZERO
    remaining = (AMT - principal) + (PENALTY - penalty)
    assert remaining == Decimal("80.00")


def test_weekly_grace_aging():
    """Test 7 — same engine on weekly schedule."""
    due_start = date(2026, 1, 5)  # Monday
    schedules = _build_loan_schedules(
        8, due_start=due_start, frequency="WEEKLY", amount=AMT
    )
    grace = 2
    penalty = Decimal("50.00")

    # On installment index 3 (4th week): elapsed for index 0 = 3 > 2 → penalty
    as_of = schedules[3].schedule_date
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    assert payables[schedules[0].id].total_payable == Decimal("170.00")
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[3].id].total_payable == AMT  # current


def test_biweekly_grace_aging():
    """Test 8 — bi-weekly sequence aging."""
    due_start = date(2026, 1, 1)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="BI_WEEKLY", amount=AMT
    )
    grace = 1
    penalty = Decimal("100.00")
    as_of = schedules[2].schedule_date  # 3rd installment
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    # index 0: elapsed=2 > 1 → penalty; index 1: elapsed=1 not > 1
    assert payables[schedules[0].id].total_payable == Decimal("220.00")
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].total_payable == AMT


def test_monthly_grace_aging():
    """Test 9 — monthly sequence aging."""
    due_start = date(2026, 1, 15)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="MONTHLY", amount=AMT
    )
    grace = 1
    penalty = Decimal("200.00")
    as_of = schedules[2].schedule_date
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    assert payables[schedules[0].id].total_payable == Decimal("320.00")
    assert payables[schedules[2].id].penalty_outstanding == ZERO


def test_zero_config_never_penalizes():
    """Backward compatible: grace=0, penalty=0 → no fees (existing loans)."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=20)
    payables = _payable_map(
        schedules, grace=0, penalty=ZERO, as_of=as_of
    )
    # grace=0 means elapsed > 0 → eligible, but penalty amount is 0
    for sched in schedules:
        if sched.schedule_date < as_of:
            p = payables[sched.id]
            assert p.penalty_outstanding == ZERO
            assert p.total_payable == AMT


def test_grace_zero_with_penalty_applies_immediately_when_next_arrives():
    """grace=0: penalty as soon as a subsequent installment date is reached."""
    schedules = _build_loan_schedules(5, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=1)  # Day 2
    payables = _payable_map(
        schedules, grace=0, penalty=PENALTY, as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[1].id].total_payable == AMT


def test_settings_defaults_helper():
    settings = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=Decimal("10.00"),
        weekly_grace_installments=1,
        weekly_penalty_per_installment=Decimal("50.00"),
        bi_weekly_grace_installments=1,
        bi_weekly_penalty_per_installment=Decimal("100.00"),
        monthly_grace_installments=1,
        monthly_penalty_per_installment=Decimal("200.00"),
    )
    assert penalty_defaults_from_settings(settings, "DAILY") == (3, Decimal("10.00"))
    assert penalty_defaults_from_settings(settings, "WEEKLY") == (1, Decimal("50.00"))
    assert penalty_defaults_from_settings(settings, "BI_WEEKLY") == (
        1,
        Decimal("100.00"),
    )
    assert penalty_defaults_from_settings(settings, "MONTHLY") == (1, Decimal("200.00"))
    assert penalty_defaults_from_settings(None, "DAILY") == (0, ZERO)


def test_original_amount_never_mutated_conceptually():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=10)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    for sched in schedules:
        p = payables[sched.id]
        assert p.original_amount == AMT
        assert Decimal(sched.expected_amount) == AMT
