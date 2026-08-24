"""
Local-only Simulation API (no Postgres / Docker required).

Provides fake login + hypothetical simulation so you can check the UI locally.

Usage (repo root):
  .\\.venv\\Scripts\\python.exe scripts\\run_simulation_local.py

Then frontend:
  VITE_API_BASE_URL=http://127.0.0.1:8000
  npm run dev

Login: any email / any password (e.g. sim@local.dev / sim)
"""

from __future__ import annotations

import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("SECRET_KEY", "financeflow-dev-secret-change-in-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "120")

from fastapi import FastAPI, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.app.core.security import create_access_token
from backend.app.api.simulation import _config_from_request, _serialize_result
from backend.app.schemas.simulation import SimulationRunRequest, ScenarioCompareRequest
from backend.app.simulation.engine import run_simulation
from backend.app.simulation.models import SimulationMode, SimulationSnapshot
from backend.app.simulation.money import money

app = FastAPI(title="FinanceFlow Simulation (local)", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_bearer(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return authorization[7:].strip()


@app.get("/")
def root():
    return {
        "message": "Local simulation API (offline)",
        "login": "POST /finance-owners/login — any credentials",
        "docs": "/docs",
    }


@app.post("/finance-owners/login")
def login(username: str = Form(...), password: str = Form(...)):
    token = create_access_token(
        {"sub": username or "sim@local.dev", "owner_id": 1, "actor_type": "owner"}
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/agents/session")
def session(authorization: str | None = Header(default=None)):
    _require_bearer(authorization)
    return {
        "actor_type": "owner",
        "display_name": "Local Simulation",
        "finance_owner_id": 1,
        "agent_id": None,
        "permissions": [],
        "is_owner": True,
    }


@app.get("/finance-owners/me")
def me(authorization: str | None = Header(default=None)):
    _require_bearer(authorization)
    return {
        "id": 1,
        "business_name": "Local Sim Finance",
        "owner_name": "Local Simulation",
        "email": "sim@local.dev",
        "phone": "9999999999",
    }


@app.get("/simulation/snapshot")
def snapshot(authorization: str | None = Header(default=None)):
    _require_bearer(authorization)
    return {
        "snapshot_date": date.today().isoformat(),
        "available_cash": "100000.00",
        "outstanding_principal": "0.00",
        "active_loan_count": 0,
        "currency": "INR",
        "products": [],
        "meta": {"source": "local_offline"},
    }


@app.post("/simulation/run")
def run(body: SimulationRunRequest, authorization: str | None = Header(default=None)):
    _require_bearer(authorization)
    # Force hypothetical offline path
    body.simulation_mode = "HYPOTHETICAL"
    if body.capital_source == "CURRENT":
        body.capital_source = "MANUAL"
    config = _config_from_request(body)
    if not config.products:
        raise HTTPException(status_code=400, detail="At least one loan product is required.")
    starting = money(body.manual_starting_capital)
    if body.capital_source == "CURRENT_PLUS_ADDITIONAL":
        starting = money(body.manual_starting_capital + body.additional_capital)
    snapshot = SimulationSnapshot(
        snapshot_date=body.start_date or date.today(),
        available_cash=starting,
        outstanding_principal=Decimal("0"),
        active_loan_count=0,
        existing_loans=[],
        products=config.products,
        meta={"source": "local_offline"},
    )
    config.simulation_mode = SimulationMode.HYPOTHETICAL
    config.start_date = snapshot.snapshot_date
    try:
        result = run_simulation(config, snapshot)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_result(result, body)


@app.post("/simulation/compare")
def compare(body: ScenarioCompareRequest, authorization: str | None = Header(default=None)):
    _require_bearer(authorization)
    if len(body.scenarios) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two scenarios.")
    out = []
    for sc in body.scenarios:
        resp = run(sc, authorization)
        out.append({"name": sc.scenario_name or "Scenario", "summary": resp.summary.model_dump()})
    return {"read_only": True, "scenarios": out}


if __name__ == "__main__":
    print("=" * 60)
    print("Local Simulation API  http://127.0.0.1:8000/docs")
    print("Login with any email/password after pointing Vite to this API")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
