"""
Unit tests for data validation, cleaning, and schema integrity in SMARTTRUST.
"""

import pandas as pd
import pytest

from ..exceptions import SchemaError, ValidationError
from ..validation import (
    clean_cleaning_records,
    clean_cleaning_schedule,
    clean_energy_records,
    clean_milk_loss_records,
    clean_packaging_records,
    clean_production_records,
    load_dataset,
)


def test_empty_dataset_raises_validation_error():
    empty_df = pd.DataFrame()
    with pytest.raises(ValidationError) as exc_info:
        clean_energy_records(empty_df)
    assert "is empty" in exc_info.value.message
    assert exc_info.value.dataset == "energy_records"


def test_missing_required_schema_column_raises_schema_error():
    # Missing 'energy_kwh' column
    df = pd.DataFrame([
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1"}
    ])
    with pytest.raises(SchemaError) as exc_info:
        clean_energy_records(df)
    assert "energy_kwh" in exc_info.value.missing_columns
    assert exc_info.value.dataset == "energy_records"


def test_production_missing_both_output_columns_raises_schema_error():
    df = pd.DataFrame([
        {"date": "2026-10-01", "batch_id": "B01", "product_type": "Whole Milk", "milk_input_litres": 1000}
    ])
    with pytest.raises(SchemaError) as exc_info:
        clean_production_records(df)
    assert "finished_output" in exc_info.value.message


def test_negative_energy_raises_validation_error():
    df = pd.DataFrame([
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1", "energy_kwh": -15.5}
    ])
    with pytest.raises(ValidationError) as exc_info:
        clean_energy_records(df)
    assert "Impossible negative energy" in exc_info.value.message
    assert exc_info.value.field == "energy_kwh"
    assert exc_info.value.value == -15.5


def test_impossible_runtime_hours_raises_validation_error():
    df = pd.DataFrame([
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1", "energy_kwh": 50.0, "runtime_hours": 28.0}
    ])
    with pytest.raises(ValidationError) as exc_info:
        clean_energy_records(df)
    assert "Impossible runtime_hours" in exc_info.value.message
    assert exc_info.value.field == "runtime_hours"


def test_invalid_cleaning_status_raises_validation_error():
    df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "shift": "Morning",
            "equipment_id": "EQ01",
            "status": "partially_done",  # Invalid
            "submitted_by": "Worker",
            "verified_by": "Supervisor",
        }
    ])
    with pytest.raises(ValidationError) as exc_info:
        clean_cleaning_records(df)
    assert "Invalid cleaning status" in exc_info.value.message


def test_negative_milk_loss_raises_validation_error():
    df = pd.DataFrame([
        {"date": "2026-10-01", "batch_id": "B01", "loss_litres": -50.0}
    ])
    with pytest.raises(ValidationError) as exc_info:
        clean_milk_loss_records(df)
    assert "Impossible negative loss_litres" in exc_info.value.message


def test_negative_packaging_quantities_raises_validation_error():
    df = pd.DataFrame([
        {
            "date": "2026-10-01",
            "material_type": "Pouch",
            "issued_qty": 1000,
            "used_qty": 900,
            "damaged_qty": -10,  # Negative
            "rejected_qty": 5,
        }
    ])
    with pytest.raises(ValidationError) as exc_info:
        clean_packaging_records(df)
    assert "Impossible negative damaged_qty" in exc_info.value.message


def test_duplicate_records_deduplicated_with_warning():
    df = pd.DataFrame([
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1", "energy_kwh": 100.0},
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1", "energy_kwh": 105.0},
    ])
    cleaned_df, warnings = clean_energy_records(df)
    assert len(cleaned_df) == 1
    assert any("Removed 1 duplicate" in w for w in warnings)


def test_optional_columns_degrade_gracefully():
    # energy_records without runtime_hours or production_units
    df = pd.DataFrame([
        {"date": "2026-10-01", "machine_id": "M1", "machine_name": "Motor 1", "energy_kwh": 100.0}
    ])
    cleaned_df, warnings = clean_energy_records(df)
    assert len(cleaned_df) == 1
    assert any("Optional column 'runtime_hours'" in w for w in warnings)
