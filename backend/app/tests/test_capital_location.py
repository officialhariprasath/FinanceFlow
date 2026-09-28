"""Unit tests for Option A capital location / FIFO settlement split."""

from decimal import Decimal
from types import SimpleNamespace

from backend.app.services.capital_location_service import (
    split_settlement_amount,
    unsettled_collection_split,
)


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
    def __init__(self, payments, settlements, wallets):
        self.payments = payments
        self.settlements = settlements
        self.wallets = wallets

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if "Payment" in name:
            return _Query(self.payments)
        if "AgentSettlement" in name:
            return _Query(self.settlements)
        return _Query([])


def test_unsettled_split_fifo_with_partial_settlement(monkeypatch):
    payments = [
        SimpleNamespace(
            amount_paid=Decimal("120.00"),
            principal_paid=Decimal("100.00"),
            interest_paid=Decimal("20.00"),
            payment_date="2026-09-01",
            id=1,
            collected_by_agent_id=3,
        ),
        SimpleNamespace(
            amount_paid=Decimal("120.00"),
            principal_paid=Decimal("100.00"),
            interest_paid=Decimal("20.00"),
            payment_date="2026-09-02",
            id=2,
            collected_by_agent_id=3,
        ),
    ]
    settlements = [
        SimpleNamespace(total_amount=Decimal("120.00"), status="COMPLETED"),
    ]
    db = _DB(payments, settlements, [])

    monkeypatch.setattr(
        "backend.app.services.capital_location_service.list_all_agent_wallets",
        lambda *_a, **_k: [
            {
                "unsettled_balance": Decimal("120.00"),
                "total_balance": Decimal("120.00"),
            }
        ],
    )

    split = unsettled_collection_split(db, finance_owner_id=2)
    assert split["unsettled_total"] == Decimal("120.00")
    assert split["capital_with_agents"] == Decimal("100.00")
    assert split["profit_with_agents"] == Decimal("20.00")


def test_split_settlement_amount_takes_oldest_unsettled(monkeypatch):
    payments = [
        SimpleNamespace(
            amount_paid=Decimal("120.00"),
            principal_paid=Decimal("100.00"),
            interest_paid=Decimal("20.00"),
            payment_date="2026-09-01",
            id=1,
            collected_by_agent_id=3,
        ),
        SimpleNamespace(
            amount_paid=Decimal("240.00"),
            principal_paid=Decimal("200.00"),
            interest_paid=Decimal("40.00"),
            payment_date="2026-09-02",
            id=2,
            collected_by_agent_id=3,
        ),
    ]
    db = _DB(payments, [], [])
    monkeypatch.setattr(
        "backend.app.services.capital_location_service._completed_settlement_total",
        lambda *_a, **_k: Decimal("0.00"),
    )
    split = split_settlement_amount(db, 2, Decimal("120.00"))
    assert split["principal_amount"] == Decimal("100.00")
    assert split["profit_amount"] == Decimal("20.00")
