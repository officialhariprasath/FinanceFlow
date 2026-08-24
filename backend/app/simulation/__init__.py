"""
Dynamic lending simulation & financial forecasting engine.

Read-only projections — never mutates real ledger / loan / payment data.
"""

from backend.app.simulation.engine import run_simulation
from backend.app.simulation.models import SimulationConfig, SimulationResult

__all__ = ["run_simulation", "SimulationConfig", "SimulationResult"]
