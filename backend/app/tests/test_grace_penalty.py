"""
Last-N grace + most-late penalty tests.

Grace protects the newest N overdue unpaid installments (closest to today).
Penalty applies to older overdue unpaid installments (most late).
Grace is recalculated whenever the overdue unpaid set changes after payments.
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


DUE_START = date(2026, 1, 1)
GRACE = 3
PENALTY = Decimal("10.00")
AMT = Decimal("120.00")


def test_day1_current_no_penalty():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=DUE_START)
    assert payables[schedules[0].id].total_payable == AMT
    assert payables[schedules[0].id].penalty_outstanding == ZERO


def test_overdue_count_within_grace_no_penalty():
    """≤ grace overdue → all free."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    for day_offset in (1, 2, 3):  # Days 2–4: 1–3 overdue
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        for sched in schedules:
            if sched.schedule_date > as_of:
                continue
            assert payables[sched.id].penalty_outstanding == ZERO


def test_six_overdue_grace_5_first_day_penalized():
    """Case A: 6 overdue, grace=5 → only oldest (Day 1) has penalty."""
    schedules = _build_loan_schedules(12, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=6)  # Day 7 current; overdue Days 1–6
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("170.00")
    for i in range(1, 6):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].within_grace is True
    assert payables[schedules[6].id].total_payable == AMT  # today


def test_seven_overdue_grace_5_first_two_penalized():
    """Case B: 7 overdue, grace=5 → oldest 2 have penalty."""
    schedules = _build_loan_schedules(12, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=7)  # Day 8; overdue 1–7
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("170.00")
    assert payables[schedules[1].id].total_payable == Decimal("170.00")
    for i in range(2, 7):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].within_grace is True
    assert payables[schedules[7].id].total_payable == AMT


def test_pay_oldest_three_then_recalculate_grace():
    """
    Case C: start with 7 overdue / grace=5 (Days 1–2 penalized).
    Pay Days 1–3 → remaining 4 overdue ≤ 5 → all free again.
    """
    schedules = _build_loan_schedules(12, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=7)
    before = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert before[schedules[0].id].penalty_outstanding == Decimal("50.00")
    assert before[schedules[1].id].penalty_outstanding == Decimal("50.00")

    for i in range(3):
        schedules[i].paid_amount = AMT
        schedules[i].paid_principal = AMT
        schedules[i].paid_penalty = (
            Decimal("50.00") if before[schedules[i].id].penalty_outstanding > ZERO else ZERO
        )

    after = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    for i in range(3):
        assert after[schedules[i].id].total_payable == ZERO
    for i in range(3, 7):
        assert after[schedules[i].id].penalty_outstanding == ZERO
        assert after[schedules[i].id].within_grace is True
        assert after[schedules[i].id].total_payable == AMT


def test_pay_oldest_three_longer_arrears_reassigns_penalty():
    """
    10 overdue, grace=5: Days 1–5 penalized, 6–10 grace.
    Pay Days 1–3 → remaining 7 overdue → Days 4–5 penalized, 6–10 grace.
    """
    schedules = _build_loan_schedules(15, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=10)  # Day 11; overdue 1–10
    before = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    for i in range(5):
        assert before[schedules[i].id].penalty_outstanding == Decimal("50.00")
    for i in range(5, 10):
        assert before[schedules[i].id].within_grace is True

    for i in range(3):
        schedules[i].paid_amount = AMT
        schedules[i].paid_principal = AMT
        schedules[i].paid_penalty = Decimal("50.00")

    after = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert after[schedules[3].id].total_payable == Decimal("170.00")
    assert after[schedules[4].id].total_payable == Decimal("170.00")
    for i in range(5, 10):
        assert after[schedules[i].id].penalty_outstanding == ZERO


def test_day5_grace_3_oldest_one_penalized():
    """Day 5, grace=3, 4 overdue → Day 1 ₹130; Days 2–4 grace; Day 5 current."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[3].id].penalty_outstanding == ZERO
    assert payables[schedules[4].id].total_payable == AMT


def test_day6_grace_3_oldest_two_penalized():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=5)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == Decimal("130.00")
    assert payables[schedules[1].id].total_payable == Decimal("130.00")
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[5].id].total_payable == AMT


def test_oct8_grace_5_matches_last_n_screenshot_pattern():
    """Today Oct 8, overdue Oct 2–7 (6 days), grace=5 → Oct 2 penalized, Oct 3–7 grace."""
    due_start = date(2026, 10, 2)
    schedules = _build_loan_schedules(10, due_start=due_start, amount=AMT)
    as_of = date(2026, 10, 8)
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("170.00")  # Oct 2
    for i in range(1, 6):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].within_grace is True
    assert payables[schedules[6].id].total_payable == AMT  # today


def test_no_overdue_when_day1_paid():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    schedules[0].paid_amount = AMT
    schedules[0].paid_principal = AMT
    as_of = DUE_START + timedelta(days=1)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == ZERO
    assert payables[schedules[1].id].total_payable == AMT


def test_penalty_never_compounds():
    schedules = _build_loan_schedules(20, due_start=DUE_START)
    for day_offset in range(4, 15):
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        day1 = payables[schedules[0].id]
        assert day1.total_payable == Decimal("130.00")
        assert day1.original_amount == AMT


def test_payment_clears_penalty_on_oldest():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
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


def test_partial_payment_leaves_remaining():
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == Decimal("50.00")
    assert (AMT - principal) + (PENALTY - penalty) == Decimal("80.00")


def test_weekly_last_n_grace():
    due_start = date(2026, 1, 5)
    schedules = _build_loan_schedules(
        8, due_start=due_start, frequency="WEEKLY", amount=AMT
    )
    # On 4th installment: overdue=[0,1,2], grace=2 → oldest 1 penalized
    as_of = schedules[3].schedule_date
    payables = _payable_map(
        schedules, grace=2, penalty=Decimal("50.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("170.00")
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[3].id].total_payable == AMT


def test_biweekly_last_n_grace():
    due_start = date(2026, 1, 1)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="BI_WEEKLY", amount=AMT
    )
    as_of = schedules[2].schedule_date  # overdue=[0,1], grace=1 → oldest penalized
    payables = _payable_map(
        schedules, grace=1, penalty=Decimal("100.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("220.00")
    assert payables[schedules[1].id].within_grace is True
    assert payables[schedules[2].id].total_payable == AMT


def test_monthly_last_n_grace():
    due_start = date(2026, 1, 15)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="MONTHLY", amount=AMT
    )
    as_of = schedules[2].schedule_date
    payables = _payable_map(
        schedules, grace=1, penalty=Decimal("200.00"), as_of=as_of
    )
    assert payables[schedules[0].id].total_payable == Decimal("320.00")
    assert payables[schedules[1].id].penalty_outstanding == ZERO


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


def test_settings_change_grace_5_to_3_recalculates_most_late():
    from backend.app.services.penalty_service import (
        compute_loan_payables_for_loan,
        sync_loan_penalty_fields,
    )

    schedules = _build_loan_schedules(12, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=7)  # 7 overdue
    loan = SimpleNamespace(
        collection_model="DAILY_COLLECTION",
        collection_frequency="DAILY",
        grace_installments=5,
        penalty_per_installment=Decimal("50.00"),
        schedules=schedules,
    )
    settings_5 = SimpleNamespace(
        daily_grace_installments=5,
        daily_penalty_per_installment=Decimal("50.00"),
        weekly_grace_installments=0,
        weekly_penalty_per_installment=ZERO,
        bi_weekly_grace_installments=0,
        bi_weekly_penalty_per_installment=ZERO,
        monthly_grace_installments=0,
        monthly_penalty_per_installment=ZERO,
    )
    settings_3 = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=Decimal("50.00"),
        weekly_grace_installments=0,
        weekly_penalty_per_installment=ZERO,
        bi_weekly_grace_installments=0,
        bi_weekly_penalty_per_installment=ZERO,
        monthly_grace_installments=0,
        monthly_penalty_per_installment=ZERO,
    )
    before = compute_loan_payables_for_loan(
        loan, schedules, as_of=as_of, settings=settings_5
    )
    # grace 5, 7 overdue → 2 penalized
    assert before[schedules[0].id].penalty_outstanding == Decimal("50.00")
    assert before[schedules[1].id].penalty_outstanding == Decimal("50.00")
    assert before[schedules[2].id].penalty_outstanding == ZERO

    sync_loan_penalty_fields(loan, settings_3)
    after = compute_loan_payables_for_loan(
        loan, schedules, as_of=as_of, settings=settings_3
    )
    # grace 3, 7 overdue → 4 penalized
    for i in range(4):
        assert after[schedules[i].id].penalty_outstanding == Decimal("50.00")
    assert after[schedules[4].id].within_grace is True


def test_backfill_installment_loan_penalties_updates_rows():
    from backend.app.services import finance_settings_service as svc

    settings = SimpleNamespace(
        daily_grace_installments=5,
        daily_penalty_per_installment=Decimal("50.00"),
        weekly_grace_installments=1,
        weekly_penalty_per_installment=Decimal("50.00"),
        bi_weekly_grace_installments=0,
        bi_weekly_penalty_per_installment=ZERO,
        monthly_grace_installments=0,
        monthly_penalty_per_installment=ZERO,
    )
    loan_a = SimpleNamespace(
        id=1,
        collection_model="DAILY_COLLECTION",
        collection_frequency="DAILY",
        grace_installments=0,
        penalty_per_installment=ZERO,
    )

    class _FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return [loan_a]

    class _FakeDB:
        def query(self, *_args):
            return _FakeQuery()

    count = svc.backfill_installment_loan_penalties(
        _FakeDB(), finance_owner_id=1, settings=settings
    )
    assert count == 1
    assert loan_a.grace_installments == 5
    assert loan_a.penalty_per_installment == Decimal("50.00")
