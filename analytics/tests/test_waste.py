"""
Unit and integration tests for Module 3: Waste Analytics.
Includes test asserting that excess packaging is flagged for investigation,
never labelled as confirmed waste.
"""

import pandas as pd
import pytest

from ..waste_analytics import run_waste_analytics


def test_milk_wastage_percentage_calculation():
    prod_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "batch_id": "BATCH_01",
            "product_type": "Toned Milk",
            "milk_input_litres": 10000.0,
            "finished_output_litres": 9800.0,
            "finished_output_units": 9800,
        }
    ])
    loss_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "batch_id": "BATCH_01",
            "loss_litres": 450.0,  # 450 / 10000 = 4.5% loss (MEDIUM severity)
            "reason": "Shrinkage",
        }
    ])

    res = run_waste_analytics(production_records=prod_df, milk_loss_records=loss_df)
    batch_loss = res["milk_loss_summary"]["batch_losses"][0]
    assert batch_loss["loss_percent"] == 4.5
    assert len(res["alerts"]) == 1
    assert res["alerts"][0]["severity"] == "MEDIUM"
    assert res["alerts"][0]["category"] == "WASTE"


def test_excess_packaging_flagged_for_investigation_not_confirmed_waste():
    """
    CRITICAL TEST REQUIRED BY SPEC:
    Asserting that excess packaging is flagged for investigation,
    not labelled as confirmed waste.
    """
    prod_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "batch_id": "BATCH_01",
            "product_type": "Pouch Milk",
            "milk_input_litres": 5000.0,
            "finished_output_litres": 5000.0,
            "finished_output_units": 10000,
        }
    ])

    # Expected at 1.0 ratio is 10,000 pouches. Used is 12,500 (+25% excess).
    pkg_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "material_type": "HDPE_Pouch",
            "issued_qty": 13000,
            "used_qty": 12500,
            "damaged_qty": 500,
            "rejected_qty": 200,
            "units_per_package_ratio": 1.0,
        }
    ])

    res = run_waste_analytics(production_records=prod_df, packaging_records=pkg_df)

    # 1. Check material summary status
    materials = res["packaging_reconciliation"]["materials"]
    assert len(materials) == 1
    mat = materials[0]
    assert mat["investigation_status"] == "FLAGGED_FOR_INVESTIGATION"
    assert mat["investigation_status"] != "CONFIRMED_WASTE"
    assert len(mat["candidate_explanations"]) >= 4

    # 2. Check generated alert
    assert len(res["alerts"]) == 1
    alert = res["alerts"][0]

    # Verify that the alert is explicitly marked FLAGGED_FOR_INVESTIGATION
    assert "FLAGGED_FOR_INVESTIGATION" in alert["explanation"]
    assert "never classified as confirmed waste" in alert["explanation"]
    assert "Investigate" in alert["recommendation"]

    # Assert that neither alert explanation nor recommendation calls it confirmed waste
    assert "confirmed waste" not in alert["recommendation"].lower()
    assert "Packaging material usage exceeds the expected production-based quantity" in alert["recommendation"]


def test_zero_production_and_zero_denominator_handled_gracefully():
    """Guards against division by zero in zero-input or zero-output conditions."""
    prod_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "batch_id": "BATCH_ZERO",
            "product_type": "Test Milk",
            "milk_input_litres": 0.0,
            "finished_output_litres": 0.0,
            "finished_output_units": 0,
        }
    ])
    loss_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "batch_id": "BATCH_ZERO",
            "loss_litres": 0.0,
        }
    ])
    pkg_df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "material_type": "Pouch",
            "issued_qty": 0,
            "used_qty": 0,
            "damaged_qty": 0,
            "rejected_qty": 0,
            "units_per_package_ratio": 1.0,
        }
    ])

    # Should execute without throwing ZeroDivisionError
    res = run_waste_analytics(
        production_records=prod_df,
        milk_loss_records=loss_df,
        packaging_records=pkg_df,
    )
    assert res is not None
    materials = res["packaging_reconciliation"]["materials"]
    assert materials[0]["damaged_percent"] == 0.0
