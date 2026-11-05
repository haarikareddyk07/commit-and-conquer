"""
Unit and integration tests for Module 1: Energy Analytics.
"""

from datetime import date, timedelta
import pandas as pd
import pytest

from ..config import AnalyticsConfig
from ..energy_analytics import run_energy_analytics


def test_worked_example_100_to_150_kwh_yields_high_severity_alert():
    """
    Test explicitly requested in prompt:
    A machine with a 100 kWh baseline recording 150 kWh yields a +50% increase,
    an alert with high severity (per default thresholds), and a recommendation
    to inspect the equipment.
    """
    # Create 10 historical records at exactly 100.0 kWh baseline, followed by 150.0 kWh on day 11
    start_date = date(2026, 10, 1)
    records = []
    for i in range(10):
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "machine_id": "CHILLER_01",
            "machine_name": "Chiller 01",
            "energy_kwh": 100.0,
            "runtime_hours": 16.0,
            "production_units": 1000,
        })
    # Day 11: 150 kWh
    records.append({
        "date": str(start_date + timedelta(days=10)),
        "machine_id": "CHILLER_01",
        "machine_name": "Chiller 01",
        "energy_kwh": 150.0,
        "runtime_hours": 16.0,
        "production_units": 1000,
    })

    df = pd.DataFrame(records)
    res = run_energy_analytics(df)

    assert len(res["alerts"]) == 1
    alert = res["alerts"][0]

    assert alert["category"] == "ENERGY"
    assert alert["severity"] == "HIGH"
    assert alert["detected_value"] == 150.0
    assert alert["expected_value"] == 100.0
    assert alert["deviation_percent"] == 50.0
    assert alert["unit"] == "kWh"
    assert "Chiller 01" in alert["affected_equipment"]
    assert "inspect the equipment" in alert["recommendation"].lower()
    assert "is significantly higher than its historical baseline" in alert["recommendation"]
    assert "+50.0%" in alert["explanation"]


def test_insufficient_baseline_history_marks_status_and_avoids_alert():
    """
    Machines with fewer than min_history_records (default 7) must be marked
    'INSUFFICIENT_BASELINE' rather than guessing.
    """
    start_date = date(2026, 10, 1)
    records = []
    # Only 4 records (below default minimum 7)
    for i in range(4):
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "machine_id": "NEW_PUMP_01",
            "machine_name": "New Pump 01",
            "energy_kwh": 200.0 if i == 3 else 100.0,
        })

    df = pd.DataFrame(records)
    res = run_energy_analytics(df)

    # Should NOT generate a false alert
    assert len(res["alerts"]) == 0
    machine_summary = res["machine_summaries"]["NEW_PUMP_01"]
    assert machine_summary["baseline_status"] == "INSUFFICIENT_BASELINE"
    assert machine_summary["baseline_kwh"] is None
    assert any("Insufficient history" in w for w in res["warnings"])


def test_optional_isolation_forest_secondary_confirmation():
    """Tests that IsolationForest runs when enabled in config and sample size is adequate."""
    cfg = AnalyticsConfig()
    cfg.energy.enable_isolation_forest = True
    cfg.energy.isolation_forest_min_samples = 8

    start_date = date(2026, 10, 1)
    records = []
    for i in range(12):
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "machine_id": "CHILLER_01",
            "machine_name": "Chiller 01",
            "energy_kwh": 100.0 if i < 11 else 170.0,
        })

    df = pd.DataFrame(records)
    res = run_energy_analytics(df, config=cfg)

    assert len(res["alerts"]) == 1
    alert = res["alerts"][0]
    assert "IsolationForest secondary confirmation" in alert["explanation"]


def test_peer_comparison_and_normalization():
    """Tests runtime and production normalization and peer machine aggregation."""
    start_date = date(2026, 10, 1)
    records = []
    for i in range(8):
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "machine_id": "CHILLER_01",
            "machine_name": "Chiller 01",
            "energy_kwh": 100.0,
            "runtime_hours": 10.0,
            "production_units": 500,
        })
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "machine_id": "CHILLER_02",
            "machine_name": "Chiller 02",
            "energy_kwh": 105.0,
            "runtime_hours": 10.0,
            "production_units": 500,
        })

    df = pd.DataFrame(records)
    res = run_energy_analytics(df)

    # Check normalization in machine summaries
    m1 = res["machine_summaries"]["CHILLER_01"]
    assert m1["kwh_per_hour"] == 10.0  # 100 / 10
    assert m1["kwh_per_unit"] == 0.2   # 100 / 500

    # Peer comparison should group both chillers
    assert "Chiller" in res["trends"]["peer_comparisons"]
    assert res["trends"]["peer_comparisons"]["Chiller"]["peer_count"] == 2
