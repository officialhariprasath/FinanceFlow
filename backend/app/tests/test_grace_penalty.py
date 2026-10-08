"""
Grace-installment fixed-penalty engine tests.

Rule: among overdue unpaid installments (oldest first), the first
`grace_installments` stay without penalty; any further overdue installment
gets the fixed penalty. Current day never gets an early penalty.
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


def test_day1_missed_no_penalty():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    day1 = payables[schedules[0].id]
    assert day1.total_payable == AMT
    assert day1.penalty_outstanding == ZERO


def test_day2_to_day4_still_within_grace():
    """Overdue count ≤ grace → no penalties yet."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    for day_offset in (1, 2, 3):  # Days 2, 3, 4
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        for sched in schedules:
            if sched.schedule_date > as_of:
                continue
            assert payables[sched.id].penalty_outstanding == ZERO
            assert payables[sched.id].total_payable == AMT


def test_day4_no_penalty_on_any_installment():
    """Test 2 — on Day 4, overdue=[1,2,3] exactly grace → no penalty."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=3)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    for sched in schedules[:4]:
        assert payables[sched.id].penalty_outstanding == ZERO
        assert payables[sched.id].total_payable == AMT


def test_day5_first_penalty_on_day4_current_untouched():
    """
    Test 3 — on Day 5: overdue=[1,2,3,4]
    First 3 free; Day 4 gets ₹130; Day 5 current ₹120.
    """
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)

    assert payables[schedules[0].id].total_payable == AMT  # Day 1 free
    assert payables[schedules[1].id].total_payable == AMT  # Day 2 free
    assert payables[schedules[2].id].total_payable == AMT  # Day 3 free

    day4 = payables[schedules[3].id]
    assert day4.original_amount == AMT
    assert day4.penalty_outstanding == PENALTY
    assert day4.total_payable == Decimal("130.00")
    assert day4.grace_crossed is True

    day5 = payables[schedules[4].id]
    assert day5.total_payable == AMT
    assert day5.penalty_outstanding == ZERO


def test_day6_multiple_penalties():
    """Test 4 — Day 4 & 5 penalized; Days 1–3 free; Day 6 current ₹120."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=5)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)

    assert payables[schedules[0].id].penalty_outstanding == ZERO
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[3].id].total_payable == Decimal("130.00")
    assert payables[schedules[4].id].total_payable == Decimal("130.00")
    assert payables[schedules[5].id].total_payable == AMT


def test_grace_5_oct_example_matches_user_case():
    """
    User case: grace=5, penalty=50, today=Oct 8.
    Overdue Oct 2–7 → first 5 free (2–6), Oct 7 gets ₹50, Oct 8 current free.
    """
    due_start = date(2026, 10, 2)
    schedules = _build_loan_schedules(10, due_start=due_start, amount=AMT)
    as_of = date(2026, 10, 8)
    payables = _payable_map(
        schedules, grace=5, penalty=Decimal("50.00"), as_of=as_of
    )

    # Oct 2..6 → free (grace block)
    for i in range(5):
        assert payables[schedules[i].id].penalty_outstanding == ZERO
        assert payables[schedules[i].id].total_payable == AMT
        assert payables[schedules[i].id].within_grace is True

    # Oct 7 → after grace
    oct7 = payables[schedules[5].id]
    assert oct7.schedule_date == date(2026, 10, 7)
    assert oct7.penalty_outstanding == Decimal("50.00")
    assert oct7.total_payable == Decimal("170.00")
    assert oct7.within_grace is False

    # Oct 8 today
    assert payables[schedules[6].id].total_payable == AMT
    assert payables[schedules[6].id].penalty_outstanding == ZERO
    assert payables[schedules[6].id].within_grace is False


def test_grace_3_must_not_free_last_three_before_today():
    """
    Regression for the reported bug (aging / last-3-free).

    Screenshot had: Oct 2–4 penalized, Oct 5–7 free (WRONG).
    Correct (grace=3, penalty=25, today=Oct 8):
      Oct 2–4 free (first 3 overdue), Oct 5–7 ₹145, Oct 8 ₹120.
    """
    due_start = date(2026, 10, 2)
    schedules = _build_loan_schedules(10, due_start=due_start, amount=AMT)
    as_of = date(2026, 10, 8)
    payables = _payable_map(
        schedules, grace=3, penalty=Decimal("25.00"), as_of=as_of
    )

    # First 3 overdue = Oct 2,3,4 → grace (NO penalty)
    for i, day in enumerate((2, 3, 4)):
        p = payables[schedules[i].id]
        assert p.schedule_date == date(2026, 10, day)
        assert p.penalty_outstanding == ZERO, f"Oct {day} must be within grace"
        assert p.within_grace is True
        assert p.total_payable == AMT

    # After grace = Oct 5,6,7 → penalty (NOT free)
    for i, day in enumerate((5, 6, 7), start=3):
        p = payables[schedules[i].id]
        assert p.schedule_date == date(2026, 10, day)
        assert p.penalty_outstanding == Decimal("25.00"), (
            f"Oct {day} must NOT be treated as grace (last-3-free bug)"
        )
        assert p.within_grace is False
        assert p.total_payable == Decimal("145.00")

    assert payables[schedules[6].id].total_payable == AMT  # today
    assert payables[schedules[6].id].within_grace is False


def test_no_overdue_when_day1_paid():
    """Test 1 — Day 1 paid, Day 2 current → no penalty."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    schedules[0].paid_amount = AMT
    schedules[0].paid_principal = AMT
    as_of = DUE_START + timedelta(days=1)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[0].id].total_payable == ZERO
    assert payables[schedules[1].id].total_payable == AMT
    assert payables[schedules[1].id].penalty_outstanding == ZERO


def test_penalty_never_compounds():
    """Test 10 — penalized installment stays ₹130 while unpaid."""
    schedules = _build_loan_schedules(20, due_start=DUE_START)
    for day_offset in range(4, 15):
        as_of = DUE_START + timedelta(days=day_offset)
        payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
        # Day 4 is always the first beyond grace=3 while days 1-3 remain free
        day4 = payables[schedules[3].id]
        assert day4.total_payable == Decimal("130.00")
        assert day4.penalty_amount == PENALTY
        assert day4.original_amount == AMT


def test_payment_clears_penalty():
    """Test 5 — paying ₹130 for Day 4 clears installment + penalty."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    day4 = schedules[3]
    payable = compute_installment_payable(
        day4,
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
    assert penalty == PENALTY

    day4.paid_amount = principal + profit
    day4.paid_principal = principal
    day4.paid_penalty = penalty
    after = compute_installment_payable(
        day4,
        ordered_schedules=schedules,
        grace_installments=GRACE,
        penalty_per_installment=PENALTY,
        as_of=as_of,
    )
    assert after.total_payable == ZERO


def test_partial_payment_leaves_remaining():
    """Test 6 — ₹50 against ₹130 leaves ₹80."""
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=AMT,
        penalty_remaining=PENALTY,
    )
    assert principal == Decimal("50.00")
    assert penalty == ZERO
    remaining = (AMT - principal) + (PENALTY - penalty)
    assert remaining == Decimal("80.00")


def test_weekly_grace_block():
    """Test 7 — weekly: first grace overdue free, next overdue gets penalty."""
    due_start = date(2026, 1, 5)
    schedules = _build_loan_schedules(
        8, due_start=due_start, frequency="WEEKLY", amount=AMT
    )
    grace = 2
    penalty = Decimal("50.00")
    # On 4th installment date: overdue = [0,1,2]
    as_of = schedules[3].schedule_date
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    assert payables[schedules[0].id].penalty_outstanding == ZERO
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].total_payable == Decimal("170.00")
    assert payables[schedules[3].id].total_payable == AMT


def test_biweekly_grace_block():
    """Test 8 — bi-weekly same rule."""
    due_start = date(2026, 1, 1)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="BI_WEEKLY", amount=AMT
    )
    grace = 1
    penalty = Decimal("100.00")
    as_of = schedules[2].schedule_date  # overdue=[0,1]
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    assert payables[schedules[0].id].penalty_outstanding == ZERO
    assert payables[schedules[1].id].total_payable == Decimal("220.00")
    assert payables[schedules[2].id].total_payable == AMT


def test_monthly_grace_block():
    """Test 9 — monthly same rule."""
    due_start = date(2026, 1, 15)
    schedules = _build_loan_schedules(
        6, due_start=due_start, frequency="MONTHLY", amount=AMT
    )
    grace = 1
    penalty = Decimal("200.00")
    as_of = schedules[2].schedule_date
    payables = _payable_map(schedules, grace=grace, penalty=penalty, as_of=as_of)
    assert payables[schedules[0].id].penalty_outstanding == ZERO
    assert payables[schedules[1].id].total_payable == Decimal("320.00")
    assert payables[schedules[2].id].penalty_outstanding == ZERO


def test_zero_config_never_penalizes():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=20)
    payables = _payable_map(schedules, grace=0, penalty=ZERO, as_of=as_of)
    for sched in schedules:
        if sched.schedule_date < as_of:
            assert payables[sched.id].penalty_outstanding == ZERO
            assert payables[sched.id].total_payable == AMT


def test_grace_zero_all_overdue_get_penalty():
    """grace=0 → every overdue unpaid installment gets penalty immediately."""
    schedules = _build_loan_schedules(5, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=1)
    payables = _payable_map(schedules, grace=0, penalty=PENALTY, as_of=as_of)
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
    assert penalty_defaults_from_settings(None, "DAILY") == (0, ZERO)


def test_settings_change_grace_5_to_3_affects_existing_loan_payables():
    """With grace=5 on Day 5 no penalty yet; after change to 3, Day 4 gets ₹130."""
    from backend.app.services.penalty_service import (
        compute_loan_payables_for_loan,
        sync_loan_penalty_fields,
    )

    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=4)
    loan = SimpleNamespace(
        collection_model="DAILY_COLLECTION",
        collection_frequency="DAILY",
        grace_installments=5,
        penalty_per_installment=PENALTY,
        schedules=schedules,
    )
    settings_5 = SimpleNamespace(
        daily_grace_installments=5,
        daily_penalty_per_installment=PENALTY,
        weekly_grace_installments=0,
        weekly_penalty_per_installment=ZERO,
        bi_weekly_grace_installments=0,
        bi_weekly_penalty_per_installment=ZERO,
        monthly_grace_installments=0,
        monthly_penalty_per_installment=ZERO,
    )
    settings_3 = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=PENALTY,
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
    # overdue=[1,2,3,4], grace=5 → all free
    assert before[schedules[3].id].penalty_outstanding == ZERO

    sync_loan_penalty_fields(loan, settings_3)
    after = compute_loan_payables_for_loan(
        loan, schedules, as_of=as_of, settings=settings_3
    )
    assert after[schedules[0].id].penalty_outstanding == ZERO
    assert after[schedules[3].id].total_payable == Decimal("130.00")
    assert after[schedules[4].id].total_payable == AMT


def test_backfill_syncs_all_frequencies_from_settings():
    from backend.app.services.penalty_service import sync_loan_penalty_fields

    settings = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=Decimal("10.00"),
        weekly_grace_installments=1,
        weekly_penalty_per_installment=Decimal("50.00"),
        bi_weekly_grace_installments=1,
        bi_weekly_penalty_per_installment=Decimal("100.00"),
        monthly_grace_installments=2,
        monthly_penalty_per_installment=Decimal("200.00"),
    )
    daily = SimpleNamespace(
        collection_model="DAILY_COLLECTION",
        collection_frequency="DAILY",
        grace_installments=0,
        penalty_per_installment=ZERO,
    )
    sync_loan_penalty_fields(daily, settings)
    assert daily.grace_installments == 3
    assert daily.penalty_per_installment == Decimal("10.00")


def test_backfill_installment_loan_penalties_updates_rows():
    from backend.app.services import finance_settings_service as svc

    settings = SimpleNamespace(
        daily_grace_installments=3,
        daily_penalty_per_installment=Decimal("10.00"),
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
        grace_installments=5,
        penalty_per_installment=Decimal("10.00"),
    )
    loan_b = SimpleNamespace(
        id=2,
        collection_model="DAILY_COLLECTION",
        collection_frequency="WEEKLY",
        grace_installments=2,
        penalty_per_installment=Decimal("50.00"),
    )

    class _FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return [loan_a, loan_b]

    class _FakeDB:
        def query(self, *_args):
            return _FakeQuery()

    count = svc.backfill_installment_loan_penalties(
        _FakeDB(), finance_owner_id=1, settings=settings
    )
    assert count == 2
    assert loan_a.grace_installments == 3
    assert loan_b.grace_installments == 1


def test_original_amount_never_mutated_conceptually():
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    as_of = DUE_START + timedelta(days=10)
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    for sched in schedules:
        assert payables[sched.id].original_amount == AMT
        assert Decimal(sched.expected_amount) == AMT


def test_paid_overdue_does_not_consume_grace_slot():
    """If Day 1 is paid, grace applies to the next unpaid overdue rows."""
    schedules = _build_loan_schedules(10, due_start=DUE_START)
    schedules[0].paid_amount = AMT
    schedules[0].paid_principal = AMT
    as_of = DUE_START + timedelta(days=4)  # Day 5
    # overdue unpaid = [2,3,4] — all within grace=3 → no penalty
    payables = _payable_map(schedules, grace=GRACE, penalty=PENALTY, as_of=as_of)
    assert payables[schedules[1].id].penalty_outstanding == ZERO
    assert payables[schedules[2].id].penalty_outstanding == ZERO
    assert payables[schedules[3].id].penalty_outstanding == ZERO
