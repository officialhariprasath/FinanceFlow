# Dynamic Lending Simulation

Read-only forecasting module. Never writes loans, payments, capital, or ledger rows.

## Live

- Web: Insights → **Simulation** (owner only)
- API: `GET /simulation/snapshot`, `POST /simulation/run`, `POST /simulation/compare`

## Tests

```powershell
.\.venv\Scripts\python.exe -m tests.simulation.test_engine_reference
.\.venv\Scripts\python.exe -m tests.simulation.test_engine_edge_cases
```

## Local offline API (optional)

```powershell
.\.venv\Scripts\python.exe scripts\run_simulation_local.py
```
