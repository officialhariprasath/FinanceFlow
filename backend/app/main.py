"""
FINNECT Finance OS
Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import cors_origins

# -----------------------------
# API Routers
# -----------------------------
from backend.app.api.finance_owner import router as finance_owner_router
from backend.app.api.customer import router as customer_router
from backend.app.api.loan import router as loan_router
from backend.app.api.payment import router as payment_router
from backend.app.api.dashboard import router as dashboard_router
from backend.app.api.finance_settings import router as finance_settings_router
from backend.app.api.loan_renewal import router as loan_renewal_router
from backend.app.api.capital import router as capital_router
from backend.app.api.collection import router as collection_router
from backend.app.api.financeflow_dashboard import router as financeflow_dashboard_router
from backend.app.api.profit import router as profit_router
from backend.app.api.agent import router as agent_router
from backend.app.api.agent_wallet import router as agent_wallet_router
from backend.app.api.agent_settlement import router as agent_settlement_router
from backend.app.api.extended import router as extended_router

# -----------------------------
# FastAPI Application
# -----------------------------
app = FastAPI(
    title="FINNECT Finance OS",
    version="1.0.1",
)

origins = cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Register API Routers
# -----------------------------
app.include_router(finance_owner_router)
app.include_router(customer_router)
app.include_router(loan_router)
app.include_router(payment_router)
app.include_router(dashboard_router)
app.include_router(finance_settings_router)
app.include_router(loan_renewal_router)
app.include_router(capital_router)
app.include_router(collection_router)
app.include_router(financeflow_dashboard_router)
app.include_router(profit_router)
app.include_router(agent_router)
app.include_router(agent_wallet_router)
app.include_router(agent_settlement_router)
app.include_router(extended_router)

# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
def root():
    """
    Health check endpoint.
    """

    return {
        "message": "Welcome to FINNECT Finance OS API"
    }