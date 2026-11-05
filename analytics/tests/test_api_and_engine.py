"""
End-to-end orchestration and FastAPI endpoint tests.
"""

from pathlib import Path
import pandas as pd
import pytest

from ..api import (
    AllAnalyzeRequest,
    EnergyAnalyzeRequest,
    analyze_all_endpoint,
    analyze_energy_endpoint,
    health_check,
)
from ..engine import run_analytics
from ..exceptions import ValidationError

SAMPLE_DIR = Path(__file__).parent.parent / "sample_data"


def test_end_to_end_analytics_on_sample_data():
    """Tests run_analytics with all 6 simulated sample datasets."""
    inputs = {
        "energy_records": pd.read_csv(SAMPLE_DIR / "energy_records.csv"),
        "cleaning_schedule": pd.read_csv(SAMPLE_DIR / "cleaning_schedule.csv"),
        "cleaning_records": pd.read_csv(SAMPLE_DIR / "cleaning_records.csv"),
        "production_records": pd.read_csv(SAMPLE_DIR / "production_records.csv"),
        "milk_loss_records": pd.read_csv(SAMPLE_DIR / "milk_loss_records.csv"),
        "packaging_records": pd.read_csv(SAMPLE_DIR / "packaging_records.csv"),
        "data_source": "SIMULATED",
    }

    result = run_analytics(inputs)

    assert result["status"] == "SUCCESS"
    assert result["data_source"] == "SIMULATED"
    assert len(result["alerts"]) > 0
    assert result["summary"]["total_alerts"] == len(result["alerts"])
    assert "EXECUTIVE SUMMARY" in result["executive_summary"]

    # Verify that each alert satisfies Module 5 schema exactly
    required_alert_keys = [
        "alert_id",
        "title",
        "category",
        "severity",
        "affected_equipment",
        "detected_value",
        "expected_value",
        "unit",
        "deviation_percent",
        "explanation",
        "recommendation",
        "period",
        "data_source",
        "confidence_note",
    ]
    for alert in result["alerts"]:
        for k in required_alert_keys:
            assert k in alert, f"Missing key '{k}' in alert: {alert}"
        assert alert["period"]["start"] is not None
        assert alert["period"]["end"] is not None
        assert alert["data_source"] == "SIMULATED"


def test_fastapi_health_endpoint():
    res = health_check()
    assert res["status"] == "healthy"
    assert "energy" in res["supported_modules"]


def test_fastapi_analyze_all_endpoint():
    energy_data = pd.read_csv(SAMPLE_DIR / "energy_records.csv").to_dict(orient="records")
    prod_data = pd.read_csv(SAMPLE_DIR / "production_records.csv").to_dict(orient="records")

    payload = AllAnalyzeRequest(
        energy_records=energy_data,
        production_records=prod_data,
        data_source="SIMULATED",
    )
    res = analyze_all_endpoint(payload)
    assert res["status"] == "SUCCESS"
    assert "summary" in res
    assert res["summary"]["total_alerts"] >= 1


def test_fastapi_validation_error_raised():
    # Energy with negative value raises ValidationError
    payload = EnergyAnalyzeRequest(
        energy_records=[
            {
                "date": "2026-10-01",
                "machine_id": "M1",
                "machine_name": "Motor 1",
                "energy_kwh": -50.0,
            }
        ]
    )
    with pytest.raises(ValidationError) as exc_info:
        analyze_energy_endpoint(payload)
    assert exc_info.value.field == "energy_kwh"

