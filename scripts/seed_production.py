#!/usr/bin/env python3
"""Seed a deployed FinanceFlow API (demo owner, agent, loans, pages data).

Usage (after Render backend is live):

    set FINNECT_API_BASE_URL=https://financeflow-api.onrender.com
    python scripts/seed_production.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    from scripts.api_config import api_base

    base = api_base()
    if base.startswith("http://127.0.0.1") or base.startswith("http://localhost"):
        print("WARNING: FINNECT_API_BASE_URL not set — seeding LOCAL API at", base)
        print("Set FINNECT_API_BASE_URL to your Render URL for production seed.\n")

    print(f"=== Seeding {base} ===\n")

    import os

    env = {**os.environ, "FINNECT_API_BASE_URL": base, "PYTHONPATH": str(ROOT)}

    print("--- Running fresh_seed.py (includes demo pages) ---")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "fresh_seed.py")],
        cwd=ROOT,
        env=env,
    )
    if r.returncode != 0:
        print("FAILED: fresh_seed.py")
        return r.returncode

    print("\n=== Production seed complete ===")
    print("Owner: owner@financeflow.demo / Owner@12345")
    print("Agent: kumar@financeflow.demo / Agent@12345")
    return 0


if __name__ == "__main__":
    sys.exit(main())
