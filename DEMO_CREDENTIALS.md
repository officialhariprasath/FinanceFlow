# FinanceFlow Demo Credentials

Fresh database seeded for manual UI testing. **No payments collected yet** — you can walk the full flow yourself.

## URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://127.0.0.1:8000 |

## Owner login

| Field | Value |
|-------|-------|
| Login tab | **Owner** |
| Email | `owner@financeflow.demo` |
| Password | `Owner@12345` |

## Collection agent (Kumar)

| Field | Value |
|-------|-------|
| Login tab | **Agent** |
| Email | `kumar@financeflow.demo` |
| Password | `Agent@12345` |
| Assigned area | Secunderabad Zone A |
| Assigned borrowers | Ravi, Suresh, Mani (not Anitha) |

## Manager (optional)

| Field | Value |
|-------|-------|
| Login tab | **Agent** |
| Email | `manager@financeflow.demo` |
| Password | `Manager@12345` |

## Seeded data

- **Capital:** ₹1,00,000
- **4 borrowers** with permanent + temporary addresses
- **4 daily-collection loans:** ₹10,000 each, 20% / 100 days → **₹120/day**
- Kumar assigned to 3 borrowers

## Suggested test flow

1. **Agent** → Collections → Collect (Cash / UPI + reference)
2. **Agent** → My Settlement → check wallet & ledger → Submit settlement
3. **Owner** → Agent Settlements → Approve
4. **Owner** → Agents → Assign borrowers / view unsettled balances

## Reset & re-seed

```powershell
cd FINNECT-Finance-OS
.\.venv\Scripts\python scripts\truncate_all.py
.\.venv\Scripts\python scripts\fresh_seed.py
.\.venv\Scripts\python scripts\full_e2e_test.py
```
