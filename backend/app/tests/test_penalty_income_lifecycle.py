"""Edge cases for penalty as a third money component (collect → settle → owner)."""

from decimal import Decimal
from types import SimpleNamespace

from backend.app.services.capital_location_service import (
    split_settlement_amount,
    unsettled_collection_split,
)
from backend.app.services.payment_allocation_service import allocate_payment_amount

ZERO = Decimal("0.00")


class _Query:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _DB:
    def __init__(self, payments, settlements):
        self.payments = payments
        self.settlements = settlements

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if "Payment" in name:
            return _Query(self.payments)
        if "AgentSettlement" in name:
            return _Query(self.settlements)
        return _Query([])


def _pay(amount, principal, profit, penalty, pid=1):
    return SimpleNamespace(
        amount_paid=amount,
        principal_paid=principal,
        interest_paid=profit,
        allocation=SimpleNamespace(late_fee_amount=penalty),
        payment_date="2026-10-01",
        id=pid,
        collected_by_agent_id=3,
    )


def test_allocate_profit_principal_then_penalty():
    principal, profit, penalty = allocate_payment_amount(
        Decimal("170.00"),
        profit_remaining=Decimal("20.00"),
        principal_remaining=Decimal("100.00"),
        penalty_remaining=Decimal("50.00"),
    )
    assert profit == Decimal("20.00")
    assert principal == Decimal("100.00")
    assert penalty == Decimal("50.00")


def test_allocate_partial_stops_before_penalty():
    principal, profit, penalty = allocate_payment_amount(
        Decimal("90.00"),
        profit_remaining=Decimal("20.00"),
        principal_remaining=Decimal("100.00"),
        penalty_remaining=Decimal("50.00"),
    )
    assert profit == Decimal("20.00")
    assert principal == Decimal("70.00")
    assert penalty == ZERO


def test_allocate_covers_penalty_after_installment():
    principal, profit, penalty = allocate_payment_amount(
        Decimal("140.00"),
        profit_remaining=Decimal("20.00"),
        principal_remaining=Decimal("100.00"),
        penalty_remaining=Decimal("50.00"),
    )
    assert profit == Decimal("20.00")
    assert principal == Decimal("100.00")
    assert penalty == Decimal("20.00")


def test_unsettled_split_keeps_penalty_separate(monkeypatch):
    payments = [
        _pay(Decimal("170.00"), Decimal("100.00"), Decimal("20.00"), Decimal("50.00"), 1)
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service.list_all_agent_wallets",
        lambda *_a, **_k: [
            {"unsettled_balance": Decimal("170.00"), "total_balance": Decimal("170.00")}
        ],
    )
    split = unsettled_collection_split(db, finance_owner_id=2)
    assert split["unsettled_total"] == Decimal("170.00")
    assert split["capital_with_agents"] == Decimal("100.00")
    assert split["profit_with_agents"] == Decimal("20.00")
    assert split["penalty_with_agents"] == Decimal("50.00")
    assert (
        split["capital_with_agents"]
        + split["profit_with_agents"]
        + split["penalty_with_agents"]
        == split["unsettled_total"]
    )


def test_unsettled_split_derives_penalty_without_allocation(monkeypatch):
    payments = [
        SimpleNamespace(
            amount_paid=Decimal("170.00"),
            principal_paid=Decimal("100.00"),
            interest_paid=Decimal("20.00"),
            allocation=None,
            payment_date="2026-10-01",
            id=1,
            collected_by_agent_id=3,
        )
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service.list_all_agent_wallets",
        lambda *_a, **_k: [
            {"unsettled_balance": Decimal("170.00"), "total_balance": Decimal("170.00")}
        ],
    )
    split = unsettled_collection_split(db, finance_owner_id=2)
    assert split["penalty_with_agents"] == Decimal("50.00")


def test_settlement_split_three_way_full_payment(monkeypatch):
    payments = [
        _pay(Decimal("170.00"), Decimal("100.00"), Decimal("20.00"), Decimal("50.00"), 1)
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service._completed_settlement_total",
        lambda *_a, **_k: ZERO,
    )
    split = split_settlement_amount(db, 2, Decimal("170.00"))
    assert split["principal_amount"] == Decimal("100.00")
    assert split["profit_amount"] == Decimal("20.00")
    assert split["penalty_amount"] == Decimal("50.00")
    assert (
        split["principal_amount"] + split["profit_amount"] + split["penalty_amount"]
        == Decimal("170.00")
    )


def test_settlement_split_partial_takes_proportional_penalty(monkeypatch):
    """Settle half of a 170 payment → half of each component (approx)."""
    payments = [
        _pay(Decimal("170.00"), Decimal("100.00"), Decimal("20.00"), Decimal("50.00"), 1)
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service._completed_settlement_total",
        lambda *_a, **_k: ZERO,
    )
    split = split_settlement_amount(db, 2, Decimal("85.00"))
    assert split["principal_amount"] == Decimal("50.00")
    assert split["profit_amount"] == Decimal("10.00")
    assert split["penalty_amount"] == Decimal("25.00")


def test_settlement_fifo_skips_already_settled_then_takes_penalty(monkeypatch):
    payments = [
        _pay(Decimal("120.00"), Decimal("100.00"), Decimal("20.00"), ZERO, 1),
        _pay(
            Decimal("170.00"), Decimal("100.00"), Decimal("20.00"), Decimal("50.00"), 2
        ),
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service._completed_settlement_total",
        lambda *_a, **_k: Decimal("120.00"),
    )
    split = split_settlement_amount(db, 2, Decimal("170.00"))
    assert split["principal_amount"] == Decimal("100.00")
    assert split["profit_amount"] == Decimal("20.00")
    assert split["penalty_amount"] == Decimal("50.00")


def test_unsettled_after_partial_settlement_keeps_remaining_penalty(monkeypatch):
    payments = [
        _pay(Decimal("170.00"), Decimal("100.00"), Decimal("20.00"), Decimal("50.00"), 1)
    ]
    settlements = [SimpleNamespace(total_amount=Decimal("85.00"), status="COMPLETED")]
    db = _DB(payments, settlements)
    monkeypatch.setattr(
        "backend.app.services.capital_location_service.list_all_agent_wallets",
        lambda *_a, **_k: [
            {"unsettled_balance": Decimal("85.00"), "total_balance": Decimal("85.00")}
        ],
    )
    split = unsettled_collection_split(db, finance_owner_id=2)
    assert split["unsettled_total"] == Decimal("85.00")
    assert split["capital_with_agents"] == Decimal("50.00")
    assert split["profit_with_agents"] == Decimal("10.00")
    assert split["penalty_with_agents"] == Decimal("25.00")


def test_zero_penalty_payments_unchanged(monkeypatch):
    payments = [
        _pay(Decimal("120.00"), Decimal("100.00"), Decimal("20.00"), ZERO, 1)
    ]
    db = _DB(payments, [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service.list_all_agent_wallets",
        lambda *_a, **_k: [
            {"unsettled_balance": Decimal("120.00"), "total_balance": Decimal("120.00")}
        ],
    )
    split = unsettled_collection_split(db, finance_owner_id=2)
    assert split["penalty_with_agents"] == ZERO
    settle = split_settlement_amount(db, 2, Decimal("120.00"))
    # completed settlement total is 0 by default from empty settlements list
    assert settle["penalty_amount"] == ZERO
    assert settle["principal_amount"] == Decimal("100.00")
    assert settle["profit_amount"] == Decimal("20.00")
