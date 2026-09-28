"""Owner Account reservation reduces available-to-lend."""

from decimal import Decimal
from types import SimpleNamespace


def test_available_to_lend_subtracts_owner_principal(monkeypatch):
    from backend.app.services import capital_location_service as loc

    monkeypatch.setattr(
        loc,
        "get_available_capital",
        lambda *_a, **_k: Decimal("10000.00"),
    )
    monkeypatch.setattr(
        loc,
        "unsettled_collection_split",
        lambda *_a, **_k: {
            "capital_with_agents": Decimal("3000.00"),
            "profit_with_agents": Decimal("500.00"),
            "unsettled_total": Decimal("3500.00"),
        },
    )
    monkeypatch.setattr(
        "backend.app.services.owner_cash_service.get_owner_account_principal_reserved",
        lambda *_a, **_k: Decimal("2000.00"),
    )

    result = loc.get_available_to_lend(SimpleNamespace(), finance_owner_id=1)
    assert result == Decimal("5000.00")
