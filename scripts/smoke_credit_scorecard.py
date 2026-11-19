"""End-to-end smoke for hybrid credit scorecard (offline + optional API).

Usage:
  python scripts/smoke_credit_scorecard.py
  python scripts/smoke_credit_scorecard.py --api https://financeflow-api-gf0x.onrender.com --token <jwt>
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION
from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def run_offline() -> None:
    print("== Offline scorecard smoke ==")
    thin = apply_scorecard(
        {
            "history_depth": 0,
            "on_time_rate": None,
            "avg_days_late": None,
            "max_days_late": None,
            "dpd_30_rate": None,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": None,
            "days_since_last_late": None,
            "closed_loan_count": 0,
        },
        EXPERT_DEFINITION,
    )
    thick_good = apply_scorecard(
        {
            "history_depth": 8,
            "on_time_rate": 0.96,
            "avg_days_late": 0,
            "max_days_late": 1,
            "dpd_30_rate": 0,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": 1.0,
            "days_since_last_late": None,
            "closed_loan_count": 6,
        },
        EXPERT_DEFINITION,
    )
    assert 300 <= thin["score"] <= 850
    assert thick_good["score"] > thin["score"]
    assert resolve_band(thin["score"], "THIN") == "THIN_FILE"
    suggest = suggested_max_amount(
        "EXCELLENT",
        15000,
        Decimal("10000"),
        {"EXCELLENT": Decimal("1.25")},
    )
    assert suggest == Decimal("18750.00")
    print(f"thin_score={thin['score']} thick_good={thick_good['score']} suggest={suggest}")
    print("offline_ok")


def run_api(base_url: str, token: str, customer_id: int) -> None:
    import urllib.request

    print("== API smoke ==")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/credit-score/customers/{customer_id}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    assert "score" in payload and "band" in payload
    assert payload.get("advisory_only") is True
    print(json.dumps(payload, indent=2, default=str)[:800])
    print("api_ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="")
    parser.add_argument("--token", default="")
    parser.add_argument("--customer-id", type=int, default=1)
    args = parser.parse_args()
    run_offline()
    if args.api and args.token:
        run_api(args.api, args.token, args.customer_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
