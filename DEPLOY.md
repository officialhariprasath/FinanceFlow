# Go live in ~30 minutes (Render + Vercel)

## What was added in the repo

| File | Purpose |
|------|---------|
| `render.yaml` | One-click Render: Postgres + FastAPI |
| `backend/app/core/config.py` | `CORS_ORIGINS` env + `postgres://` fix |
| `scripts/seed_production.py` | Seed live API in one command |
| `frontend/.env.production.example` | Vercel env template |

---

## 1. Push code (you or CI)

```powershell
cd FINNECT-Finance-OS
git add .
git commit -m "Add Render blueprint, env CORS, production seed"
git push origin main
```

---

## 2. Render — backend + database

1. Open [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect GitHub repo `FINNECT-Finance-OS` → branch `main`
3. Render reads `render.yaml` and creates:
   - **financeflow-db** (PostgreSQL)
   - **financeflow-api** (FastAPI)
4. Wait until **financeflow-api** is **Live**
5. Copy the API URL, e.g. `https://financeflow-api.onrender.com`
6. Open `/docs` in browser — Swagger should load

**First deploy runs `alembic upgrade head` automatically.**

---

## 3. Vercel — frontend

1. Open [vercel.com/new](https://vercel.com/new) → import same GitHub repo
2. **Root Directory:** leave as **repo root** (`.`) — `vercel.json` at root builds `frontend/`
   - **Alternative:** set Root Directory to `frontend` only (then root `vercel.json` is not used)
3. **Framework:** Vite (auto-detected)
4. **Environment variable:**

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | `https://financeflow-api.onrender.com` (your Render URL) |

5. Deploy → copy Vercel URL, e.g. `https://finnect-finance-os.vercel.app`

---

## 4. CORS — allow your Vercel URL

1. Render → **financeflow-api** → **Environment**
2. Edit **CORS_ORIGINS** — comma-separated, no spaces:

   ```
   http://localhost:5173,https://YOUR-APP.vercel.app
   ```

3. **Save** → Render redeploys (~2 min)

---

## 5. Seed production demo data

From your PC (backend must be Live):

```powershell
cd FINNECT-Finance-OS
$env:FINNECT_API_BASE_URL="https://financeflow-api.onrender.com"
python scripts/seed_production.py
```

**Demo logins**

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@financeflow.demo | Owner@12345 |
| Agent | kumar@financeflow.demo | Agent@12345 |

Change passwords after go-live.

---

## 6. Share with team

Send:

- **App:** `https://YOUR-APP.vercel.app`
- **Owner login** (above)
- **Agent login** (above)

Run smoke tests from `TESTCASE.md` (15 min).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error in browser | Add exact Vercel URL to `CORS_ORIGINS` on Render |
| API slow first request | Render free tier cold start — wait ~60s |
| `alembic` failed on build | Check Render logs; verify `DATABASE_URL` linked to DB |
| Login 401 after seed | Re-run `seed_production.py`; check API URL |
| Blank frontend / network error | `VITE_API_BASE_URL` must match Render URL; redeploy Vercel |

---

## Optional: custom domain

- **Vercel:** Domains → `app.yourdomain.com`
- **Render:** Custom Domain → `api.yourdomain.com`
- Update `CORS_ORIGINS` and `VITE_API_BASE_URL` → redeploy both

---

## Local dev (unchanged)

```powershell
docker compose up -d
# backend :8000, frontend :5173
python scripts/fresh_seed.py
```
