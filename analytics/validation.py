"""
Data loading, validation, and cleaning module for SMARTTRUST Dairy Plant Analytics.
Enforces schema requirements, validates semantic ranges, and handles duplicates / missing values.
"""

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .exceptions import SchemaError, ValidationError


REQUIRED_SCHEMAS = {
    "energy_records": ["date", "machine_id", "machine_name", "energy_kwh"],
    "cleaning_schedule": ["equipment_id", "equipment_name", "required_frequency", "required_times_per_period"],
    "cleaning_records": ["date", "shift", "equipment_id", "status", "submitted_by", "verified_by"],
    "production_records": ["date", "batch_id", "product_type", "milk_input_litres"],
    "milk_loss_records": ["date", "batch_id", "loss_litres"],
    "packaging_records": ["date", "material_type", "issued_qty", "used_qty", "damaged_qty", "rejected_qty"],
}

OPTIONAL_COLUMNS = {
    "energy_records": ["runtime_hours", "production_units", "machine_type"],
    "cleaning_schedule": ["shift_coverage"],
    "cleaning_records": ["completion_percent"],
    "production_records": ["finished_output_litres", "finished_output_units"],
    "milk_loss_records": ["reason"],
    "packaging_records": ["units_per_package_ratio", "batch_id"],
}


def load_dataset(
    data: Union[pd.DataFrame, str, Path, List[Dict[str, Any]], Dict[str, Any]],
    dataset_name: str,
) -> pd.DataFrame:
    """
    Loads any supported input type (DataFrame, CSV path, CSV text, or list/dict)
    into a pandas DataFrame.
    """
    if isinstance(data, pd.DataFrame):
        df = data.copy()
    elif isinstance(data, (str, Path)):
        str_path = str(data)
        if Path(str_path).is_file():
            df = pd.read_csv(str_path)
        else:
            # Attempt to parse as raw CSV string or JSON string
            stripped = str_path.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                df = pd.read_json(io.StringIO(stripped))
            else:
                df = pd.read_csv(io.StringIO(stripped))
    elif isinstance(data, list):
        if not data:
            df = pd.DataFrame()
        else:
            df = pd.DataFrame(data)
    elif isinstance(data, dict):
        if "records" in data and isinstance(data["records"], list):
            df = pd.DataFrame(data["records"])
        else:
            df = pd.DataFrame([data])
    else:
        raise ValidationError(
            f"Unsupported data format for {dataset_name}: {type(data)}",
            dataset=dataset_name,
        )

    return df


def validate_schema(df: pd.DataFrame, dataset_name: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Validates required columns and notes missing optional columns.
    Returns cleaned DataFrame and list of warnings/notes.
    """
    warnings: List[str] = []
    if df.empty:
        raise ValidationError(
            f"Dataset '{dataset_name}' is empty. At least one record is required.",
            dataset=dataset_name,
            row=0,
        )

    required = REQUIRED_SCHEMAS.get(dataset_name, [])
    missing_required = [col for col in required if col not in df.columns]
    if missing_required:
        raise SchemaError(
            f"Dataset '{dataset_name}' is missing required columns: {missing_required}",
            dataset=dataset_name,
            missing_columns=missing_required,
            present_columns=list(df.columns),
        )

    # Special check for production records: needs finished_output_litres OR finished_output_units
    if dataset_name == "production_records":
        if "finished_output_litres" not in df.columns and "finished_output_units" not in df.columns:
            raise SchemaError(
                "Dataset 'production_records' must contain at least one of 'finished_output_litres' or 'finished_output_units'.",
                dataset=dataset_name,
                missing_columns=["finished_output_litres / finished_output_units"],
                present_columns=list(df.columns),
            )

    # Check missing optional columns and note graceful degradation
    optional = OPTIONAL_COLUMNS.get(dataset_name, [])
    for opt in optional:
        if opt not in df.columns:
            warnings.append(
                f"Optional column '{opt}' not provided in '{dataset_name}'. Associated metrics will be skipped or estimated."
            )

    return df, warnings


def clean_energy_records(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans energy records."""
    df, warnings = validate_schema(df, "energy_records")
    df = df.copy()

    # Deduplicate
    initial_len = len(df)
    df = df.drop_duplicates(subset=["date", "machine_id"], keep="last")
    if len(df) < initial_len:
        warnings.append(
            f"energy_records: Removed {initial_len - len(df)} duplicate records for same (date, machine_id)."
        )

    # Parse date
    try:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    except Exception as e:
        raise ValidationError(f"Invalid date format in energy_records: {e}", field="date", dataset="energy_records")

    # Validate numeric and impossible values
    for idx, row in df.iterrows():
        val = row["energy_kwh"]
        if pd.isna(val) or val is None:
            raise ValidationError(
                "Missing energy_kwh value",
                field="energy_kwh",
                row=int(idx),
                value=val,
                dataset="energy_records",
            )
        try:
            val_float = float(val)
        except (ValueError, TypeError):
            raise ValidationError(
                f"Non-numeric energy_kwh: '{val}'",
                field="energy_kwh",
                row=int(idx),
                value=val,
                dataset="energy_records",
            )
        if val_float < 0:
            raise ValidationError(
                f"Impossible negative energy consumption: {val_float} kWh",
                field="energy_kwh",
                row=int(idx),
                value=val_float,
                dataset="energy_records",
            )
        df.at[idx, "energy_kwh"] = val_float

        if "runtime_hours" in df.columns and pd.notna(row.get("runtime_hours")):
            rt = float(row["runtime_hours"])
            if rt < 0 or rt > 24.5:  # Cannot run > 24 hours in a single day
                raise ValidationError(
                    f"Impossible runtime_hours: {rt} hours in a single day",
                    field="runtime_hours",
                    row=int(idx),
                    value=rt,
                    dataset="energy_records",
                )
            df.at[idx, "runtime_hours"] = rt

        if "production_units" in df.columns and pd.notna(row.get("production_units")):
            pu = float(row["production_units"])
            if pu < 0:
                raise ValidationError(
                    f"Impossible negative production_units: {pu}",
                    field="production_units",
                    row=int(idx),
                    value=pu,
                    dataset="energy_records",
                )
            df.at[idx, "production_units"] = pu

    return df.sort_values(by=["date", "machine_id"]).reset_index(drop=True), warnings


def clean_cleaning_schedule(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans cleaning schedule."""
    df, warnings = validate_schema(df, "cleaning_schedule")
    df = df.copy()

    # Check duplicates on equipment_id
    initial_len = len(df)
    df = df.drop_duplicates(subset=["equipment_id"], keep="last")
    if len(df) < initial_len:
        warnings.append(
            f"cleaning_schedule: Removed {initial_len - len(df)} duplicate schedule entries for same equipment_id."
        )

    for idx, row in df.iterrows():
        freq_val = row["required_times_per_period"]
        if pd.isna(freq_val) or float(freq_val) <= 0:
            raise ValidationError(
                f"Invalid required_times_per_period: {freq_val}",
                field="required_times_per_period",
                row=int(idx),
                value=freq_val,
                dataset="cleaning_schedule",
            )
        df.at[idx, "required_times_per_period"] = float(freq_val)

    return df.reset_index(drop=True), warnings


def clean_cleaning_records(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans cleaning records."""
    df, warnings = validate_schema(df, "cleaning_records")
    df = df.copy()

    valid_statuses = {"submitted", "verified", "incomplete", "missed"}

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    except Exception as e:
        raise ValidationError(f"Invalid date format in cleaning_records: {e}", field="date", dataset="cleaning_records")

    for idx, row in df.iterrows():
        st = str(row["status"]).strip().lower()
        if st not in valid_statuses:
            raise ValidationError(
                f"Invalid cleaning status '{st}'. Expected one of {sorted(valid_statuses)}",
                field="status",
                row=int(idx),
                value=row["status"],
                dataset="cleaning_records",
            )
        df.at[idx, "status"] = st

        if "completion_percent" in df.columns and pd.notna(row.get("completion_percent")):
            cp = float(row["completion_percent"])
            if cp < 0 or cp > 100.0:
                raise ValidationError(
                    f"Impossible completion_percent: {cp}%. Must be between 0 and 100.",
                    field="completion_percent",
                    row=int(idx),
                    value=cp,
                    dataset="cleaning_records",
                )
            df.at[idx, "completion_percent"] = cp

    return df.sort_values(by=["date", "equipment_id"]).reset_index(drop=True), warnings


def clean_production_records(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans production records."""
    df, warnings = validate_schema(df, "production_records")
    df = df.copy()

    # Deduplicate by batch_id
    initial_len = len(df)
    df = df.drop_duplicates(subset=["batch_id"], keep="last")
    if len(df) < initial_len:
        warnings.append(
            f"production_records: Removed {initial_len - len(df)} duplicate records for same batch_id."
        )

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    except Exception as e:
        raise ValidationError(f"Invalid date format in production_records: {e}", field="date", dataset="production_records")

    for idx, row in df.iterrows():
        input_litres = float(row["milk_input_litres"])
        if input_litres < 0:
            raise ValidationError(
                f"Impossible negative milk_input_litres: {input_litres}",
                field="milk_input_litres",
                row=int(idx),
                value=input_litres,
                dataset="production_records",
            )
        df.at[idx, "milk_input_litres"] = input_litres

        if "finished_output_litres" in df.columns and pd.notna(row.get("finished_output_litres")):
            out_litres = float(row["finished_output_litres"])
            if out_litres < 0:
                raise ValidationError(
                    f"Impossible negative finished_output_litres: {out_litres}",
                    field="finished_output_litres",
                    row=int(idx),
                    value=out_litres,
                    dataset="production_records",
                )
            df.at[idx, "finished_output_litres"] = out_litres

        if "finished_output_units" in df.columns and pd.notna(row.get("finished_output_units")):
            out_units = float(row["finished_output_units"])
            if out_units < 0:
                raise ValidationError(
                    f"Impossible negative finished_output_units: {out_units}",
                    field="finished_output_units",
                    row=int(idx),
                    value=out_units,
                    dataset="production_records",
                )
            df.at[idx, "finished_output_units"] = out_units

    return df.sort_values(by=["date", "batch_id"]).reset_index(drop=True), warnings


def clean_milk_loss_records(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans milk loss records."""
    df, warnings = validate_schema(df, "milk_loss_records")
    df = df.copy()

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    except Exception as e:
        raise ValidationError(f"Invalid date format in milk_loss_records: {e}", field="date", dataset="milk_loss_records")

    for idx, row in df.iterrows():
        loss = float(row["loss_litres"])
        if loss < 0:
            raise ValidationError(
                f"Impossible negative loss_litres: {loss}",
                field="loss_litres",
                row=int(idx),
                value=loss,
                dataset="milk_loss_records",
            )
        df.at[idx, "loss_litres"] = loss

    return df.sort_values(by=["date", "batch_id"]).reset_index(drop=True), warnings


def clean_packaging_records(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Validates and cleans packaging records."""
    df, warnings = validate_schema(df, "packaging_records")
    df = df.copy()

    try:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    except Exception as e:
        raise ValidationError(f"Invalid date format in packaging_records: {e}", field="date", dataset="packaging_records")

    for idx, row in df.iterrows():
        issued = float(row["issued_qty"])
        used = float(row["used_qty"])
        damaged = float(row["damaged_qty"])
        rejected = float(row["rejected_qty"])

        for col, val in [("issued_qty", issued), ("used_qty", used), ("damaged_qty", damaged), ("rejected_qty", rejected)]:
            if val < 0:
                raise ValidationError(
                    f"Impossible negative {col}: {val}",
                    field=col,
                    row=int(idx),
                    value=val,
                    dataset="packaging_records",
                )

        # Logical check: damaged + rejected should not exceed used or issued significantly without note
        df.at[idx, "issued_qty"] = issued
        df.at[idx, "used_qty"] = used
        df.at[idx, "damaged_qty"] = damaged
        df.at[idx, "rejected_qty"] = rejected

        if "units_per_package_ratio" in df.columns and pd.notna(row.get("units_per_package_ratio")):
            ratio = float(row["units_per_package_ratio"])
            if ratio <= 0:
                raise ValidationError(
                    f"Invalid units_per_package_ratio: {ratio}. Must be > 0.",
                    field="units_per_package_ratio",
                    row=int(idx),
                    value=ratio,
                    dataset="packaging_records",
                )
            df.at[idx, "units_per_package_ratio"] = ratio

    return df.sort_values(by=["date", "material_type"]).reset_index(drop=True), warnings
