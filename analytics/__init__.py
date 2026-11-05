"""
SMARTTRUST - Dairy Plant Analytics Engine
Problem Statement ID: DL-SJBIT-HK26-GOVP010 | LAKSHYA 2026 Hackathon
Branch: feature/ai-analytics
"""

__version__ = "1.0.0"

from .engine import (
    run_analytics,
    run_energy_analytics,
    run_hygiene_analytics,
    run_waste_analytics,
)

__all__ = [
    "run_analytics",
    "run_energy_analytics",
    "run_hygiene_analytics",
    "run_waste_analytics",
]
