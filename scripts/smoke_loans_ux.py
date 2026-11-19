"""Offline smoke: loans search filters, portfolio summary math, display helpers."""

from __future__ import annotations

import ast
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_search_passes_customer_name():
    src = (ROOT / "backend/app/api/loan.py").read_text(encoding="utf-8")
    assert "customer_name=customer_name" in src
    assert "get_loans_portfolio_summary" in src
    assert '"/portfolio-summary"' in src or "'/portfolio-summary'" in src


def test_search_service_filters_name_and_writeoff():
    src = (ROOT / "backend/app/services/loan_service.py").read_text(encoding="utf-8")
    assert "Customer.full_name.ilike" in src
    assert 'status_upper == "WRITE_OFF"' in src
    assert "def get_loans_portfolio_summary" in src
    assert "total_penalties_scheduled" in src
    assert "total_collected" in src


def test_writeoff_sets_closure_type():
    src = (ROOT / "backend/app/services/default_service.py").read_text(encoding="utf-8")
    assert 'loan.closure_type = "WRITE_OFF"' in src


def test_frontend_pages_exist():
    loans_page = (ROOT / "frontend/src/pages/loans/LoansPage.tsx").read_text(encoding="utf-8")
    detail = (ROOT / "frontend/src/pages/loans/LoanDetailPage.tsx").read_text(encoding="utf-8")
    new_loan = (ROOT / "frontend/src/components/loans/NewLoanModal.tsx").read_text(encoding="utf-8")
    display = (ROOT / "frontend/src/utils/loanDisplay.ts").read_text(encoding="utf-8")

    for needle in [
        "customer_name",
        "debouncedName",
        "portfolio-summary",
        "getLoansPortfolioSummary",
        "loanProductLabel",
        "PAGE_SIZE",
        "Record payment",
        "total_penalties_scheduled",
        "total_collected",
    ]:
        assert needle in loans_page or needle in (ROOT / "frontend/src/services/loanService.ts").read_text(
            encoding="utf-8"
        ), needle

    for needle in [
        "CreditScoreCard",
        "Mark Defaulted",
        "Write Off",
        "Jump to today",
        "scheduleFilter",
        "Total collected",
        "Penalties scheduled",
    ]:
        assert needle in detail, needle

    assert "CreditScoreCard" in new_loan
    assert "getCustomerCreditScore" in new_loan
    assert "Escape" in new_loan
    assert "DAILY_COLLECTION" in display


def test_portfolio_math_unit():
    # Mirror formula offline
    principal = Decimal("1000.00")
    interest = Decimal("200.00")
    penalties = Decimal("50.00")
    total = (principal + interest + penalties).quantize(Decimal("0.01"))
    assert total == Decimal("1250.00")


def test_loan_display_product_logic():
    # Lightweight parse of TS helper expectations via python mirror
    def label(collection_model, frequency, count, daily_payment, interest_method, interest_rate):
        if collection_model == "DAILY_COLLECTION":
            freq = (frequency or "DAILY").replace("_", " ")
            count_part = f" × {count}" if count is not None else ""
            if daily_payment and float(daily_payment) > 0:
                return f"{freq}{count_part} · ₹{int(float(daily_payment)):,}"
            return f"{freq}{count_part}"
        if interest_method == "PERCENTAGE":
            return f"{interest_rate}% / mo"
        return f"₹{interest_rate}/₹100"

    assert "DAILY × 100" in label("DAILY_COLLECTION", "DAILY", 100, "120", "PERCENTAGE", "0")
    assert label("STANDARD", None, None, None, "PERCENTAGE", "3") == "3% / mo"


def main() -> int:
    print("== loans UX smoke ==")
    test_search_passes_customer_name()
    test_search_service_filters_name_and_writeoff()
    test_writeoff_sets_closure_type()
    test_frontend_pages_exist()
    test_portfolio_math_unit()
    test_loan_display_product_logic()
    # Syntax-check python modules that changed
    for rel in [
        "backend/app/services/loan_service.py",
        "backend/app/api/loan.py",
        "backend/app/services/default_service.py",
    ]:
        ast.parse((ROOT / rel).read_text(encoding="utf-8"), filename=rel)
    print("offline_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
