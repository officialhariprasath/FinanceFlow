"""End-to-end allocation cases for DUE_ONLY / PENALTY_ONLY / BOTH.

These cover the Record Payment Collect modes (due ₹120 + penalty ₹50 examples
and partial / leftover component cases).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from backend.app.services.payment_allocation_service import (
    allocate_payment_amount,
    normalize_allocation_mode,
)


ZERO = Decimal("0.00")
DUE_PROFIT = Decimal("20.00")
DUE_PRINCIPAL = Decimal("100.00")
DUE_TOTAL = DUE_PROFIT + DUE_PRINCIPAL  # 120
PENALTY = Decimal("50.00")
COMBINED = DUE_TOTAL + PENALTY  # 170


def _alloc(amount: str | Decimal, mode: str):
    return allocate_payment_amount(
        amount=Decimal(str(amount)),
        profit_remaining=DUE_PROFIT,
        principal_remaining=DUE_PRINCIPAL,
        penalty_remaining=PENALTY,
        allocation_mode=mode,  # type: ignore[arg-type]
    )


# ---------- normalize ----------


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, "BOTH"),
        ("", "BOTH"),
        ("both", "BOTH"),
        ("DUE", "DUE_ONLY"),
        ("due_only", "DUE_ONLY"),
        ("PENALTY", "PENALTY_ONLY"),
        ("penalty_only", "PENALTY_ONLY"),
    ],
)
def test_normalize_allocation_mode(raw, expected):
    assert normalize_allocation_mode(raw) == expected


# ---------- BOTH ----------


def test_both_exact_due_leaves_penalty():
    """Pay ₹120 with BOTH: clears due, leaves ₹50 penalty."""
    principal, profit, penalty = _alloc("120", "BOTH")
    assert profit == DUE_PROFIT
    assert principal == DUE_PRINCIPAL
    assert penalty == ZERO
    left_due = DUE_TOTAL - (principal + profit)
    left_penalty = PENALTY - penalty
    assert left_due == ZERO
    assert left_penalty == PENALTY


def test_both_exact_combined_clears_all():
    """Pay ₹170 with BOTH: due then penalty, fully clears."""
    principal, profit, penalty = _alloc("170", "BOTH")
    assert principal + profit == DUE_TOTAL
    assert penalty == PENALTY


def test_both_partial_under_due():
    """Pay ₹70 with BOTH: only part of due, no penalty yet."""
    principal, profit, penalty = _alloc("70", "BOTH")
    assert principal + profit == Decimal("70.00")
    assert penalty == ZERO


def test_both_partial_into_penalty():
    """Pay ₹140 with BOTH: full due + ₹20 of penalty."""
    principal, profit, penalty = _alloc("140", "BOTH")
    assert principal + profit == DUE_TOTAL
    assert penalty == Decimal("20.00")


# ---------- DUE_ONLY ----------


def test_due_only_exact_leaves_penalty():
    """Pay ₹120 DUE_ONLY: clears due, penalty untouched."""
    principal, profit, penalty = _alloc("120", "DUE_ONLY")
    assert principal + profit == DUE_TOTAL
    assert penalty == ZERO


def test_due_only_ignores_extra_cash_for_penalty():
    """Pay ₹170 DUE_ONLY: still only applies ₹120 to due (caller caps amount).

    Allocator itself will only spend up to due components; remainder of the
    passed amount is simply unused in the return (not applied to penalty).
    """
    principal, profit, penalty = _alloc("170", "DUE_ONLY")
    assert principal + profit == DUE_TOTAL
    assert penalty == ZERO


def test_due_only_partial():
    principal, profit, penalty = _alloc("50", "DUE_ONLY")
    assert principal + profit == Decimal("50.00")
    assert penalty == ZERO
    assert (DUE_TOTAL - Decimal("50.00")) == Decimal("70.00")


def test_due_only_zero_when_due_already_cleared():
    """If due already paid, DUE_ONLY applies nothing (penalty ignored)."""
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=ZERO,
        penalty_remaining=PENALTY,
        allocation_mode="DUE_ONLY",
    )
    assert (principal, profit, penalty) == (ZERO, ZERO, ZERO)


# ---------- PENALTY_ONLY ----------


def test_penalty_only_exact():
    principal, profit, penalty = _alloc("50", "PENALTY_ONLY")
    assert principal == ZERO and profit == ZERO
    assert penalty == PENALTY


def test_penalty_only_partial():
    principal, profit, penalty = _alloc("20", "PENALTY_ONLY")
    assert principal == ZERO and profit == ZERO
    assert penalty == Decimal("20.00")
    assert PENALTY - penalty == Decimal("30.00")


def test_penalty_only_ignores_due_even_if_amount_covers_both():
    """Pay ₹170 PENALTY_ONLY: only ₹50 penalty applied."""
    principal, profit, penalty = _alloc("170", "PENALTY_ONLY")
    assert principal == ZERO and profit == ZERO
    assert penalty == PENALTY


def test_penalty_only_zero_when_no_penalty():
    principal, profit, penalty = allocate_payment_amount(
        amount=Decimal("100.00"),
        profit_remaining=DUE_PROFIT,
        principal_remaining=DUE_PRINCIPAL,
        penalty_remaining=ZERO,
        allocation_mode="PENALTY_ONLY",
    )
    assert (principal, profit, penalty) == (ZERO, ZERO, ZERO)


# ---------- sequential day story (component leftovers) ----------


def test_story_due_only_then_penalty_only():
    """Day has due 120 + penalty 50.
    1) Collect DUE_ONLY 120 → due gone, penalty 50 left.
    2) Collect PENALTY_ONLY 50 → all clear.
    """
    p1, pr1, pe1 = _alloc("120", "DUE_ONLY")
    assert p1 + pr1 == DUE_TOTAL and pe1 == ZERO

    # After step 1: due cleared
    p2, pr2, pe2 = allocate_payment_amount(
        amount=Decimal("50.00"),
        profit_remaining=ZERO,
        principal_remaining=ZERO,
        penalty_remaining=PENALTY,
        allocation_mode="PENALTY_ONLY",
    )
    assert p2 == ZERO and pr2 == ZERO and pe2 == PENALTY


def test_story_penalty_first_then_due():
    """1) PENALTY_ONLY 50 → due 120 left.
    2) DUE_ONLY 120 → clear.
    """
    p1, pr1, pe1 = _alloc("50", "PENALTY_ONLY")
    assert pe1 == PENALTY and p1 + pr1 == ZERO

    p2, pr2, pe2 = allocate_payment_amount(
        amount=Decimal("120.00"),
        profit_remaining=DUE_PROFIT,
        principal_remaining=DUE_PRINCIPAL,
        penalty_remaining=ZERO,
        allocation_mode="DUE_ONLY",
    )
    assert p2 + pr2 == DUE_TOTAL and pe2 == ZERO


def test_story_partial_due_then_rest_both():
    """Pay 70 DUE_ONLY, then 100 BOTH → remaining due 50 + penalty 50 = 100."""
    p1, pr1, pe1 = _alloc("70", "DUE_ONLY")
    applied_due = p1 + pr1
    assert applied_due == Decimal("70.00")

    left_profit = DUE_PROFIT - pr1
    left_principal = DUE_PRINCIPAL - p1
    assert left_profit + left_principal == Decimal("50.00")

    p2, pr2, pe2 = allocate_payment_amount(
        amount=Decimal("100.00"),
        profit_remaining=left_profit,
        principal_remaining=left_principal,
        penalty_remaining=PENALTY,
        allocation_mode="BOTH",
    )
    assert p2 + pr2 == Decimal("50.00")
    assert pe2 == PENALTY


# ---------- multi-day allocation helper simulation ----------


def _apply_across_days(
    amount: Decimal,
    days: list[tuple[Decimal, Decimal, Decimal]],
    mode: str,
) -> list[tuple[Decimal, Decimal, Decimal]]:
    """Simulate _allocate_across_schedules for open days (profit, principal, penalty)."""
    remaining = amount
    out = []
    for profit_r, principal_r, penalty_r in days:
        if remaining <= ZERO:
            break
        if mode == "DUE_ONLY":
            pending = profit_r + principal_r
        elif mode == "PENALTY_ONLY":
            pending = penalty_r
        else:
            pending = profit_r + principal_r + penalty_r
        if pending <= ZERO:
            continue
        take = min(remaining, pending)
        alloc = allocate_payment_amount(
            take, profit_r, principal_r, penalty_r, mode  # type: ignore[arg-type]
        )
        paid = alloc[0] + alloc[1] + alloc[2]
        if paid <= ZERO:
            continue
        out.append(alloc)
        remaining -= paid
    return out


def test_multi_day_due_only_does_not_touch_penalties():
    days = [
        (Decimal("20"), Decimal("100"), Decimal("50")),  # day1
        (Decimal("20"), Decimal("100"), Decimal("50")),  # day2
    ]
    applied = _apply_across_days(Decimal("120.00"), days, "DUE_ONLY")
    assert len(applied) == 1
    assert applied[0][0] + applied[0][1] == Decimal("120.00")
    assert applied[0][2] == ZERO


def test_multi_day_penalty_only_walks_penalties():
    days = [
        (Decimal("20"), Decimal("100"), Decimal("50")),
        (Decimal("20"), Decimal("100"), Decimal("50")),
    ]
    applied = _apply_across_days(Decimal("80.00"), days, "PENALTY_ONLY")
    assert len(applied) == 2
    assert applied[0][2] == Decimal("50.00")
    assert applied[1][2] == Decimal("30.00")
    assert all(a[0] == ZERO and a[1] == ZERO for a in applied)


def test_multi_day_both_fills_due_then_penalty_then_next():
    days = [
        (Decimal("20"), Decimal("100"), Decimal("50")),
        (Decimal("20"), Decimal("100"), Decimal("50")),
    ]
    # 170 clears day1 fully; 20 more starts day2 due
    applied = _apply_across_days(Decimal("190.00"), days, "BOTH")
    assert len(applied) == 2
    assert applied[0][0] + applied[0][1] == Decimal("120.00")
    assert applied[0][2] == Decimal("50.00")
    assert applied[1][0] + applied[1][1] == Decimal("20.00")
    assert applied[1][2] == ZERO
