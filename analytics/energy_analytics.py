"""
Module 1: Energy Analytics for SMARTTRUST Dairy Plant Management System.
Analyzes historical energy records, establishes rolling baselines,
detects abnormal consumption via rule/statistical thresholds (and optional ML),
and computes plant-wide daily/weekly trends and peer machine comparisons.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .anomaly_detection import (
    calculate_baseline,
    calculate_linear_trend,
    calculate_percentage_increase,
    calculate_robust_zscore,
    run_isolation_forest_check,
)
from .config import AnalyticsConfig, DEFAULT_CONFIG
from .formatter import build_alert
from .recommendations import generate_energy_recommendation
from .validation import clean_energy_records, load_dataset


def extract_machine_type(machine_name: str, machine_id: str) -> str:
    """Extracts a high-level equipment group (e.g., 'Chiller', 'Pasteurizer', 'Boiler')."""
    name = (machine_name or machine_id).strip()
    # Check common plant equipment words
    for prefix in ["Chiller", "Pasteurizer", "Boiler", "Homogenizer", "Separator", "Packaging", "Pump", "Compressor"]:
        if prefix.lower() in name.lower():
            return prefix
    # Fallback to first alphabetic word
    parts = name.split()
    if parts:
        alpha = "".join([c for c in parts[0] if c.isalpha()])
        if alpha:
            return alpha.capitalize()
    return "General"


def run_energy_analytics(
    energy_records: Union[pd.DataFrame, str, List[Dict[str, Any]]],
    config: Optional[AnalyticsConfig] = None,
    data_source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes Energy Analytics on recorded energy data.
    Returns generated alerts, trends, machine metrics, and validation warnings.
    """
    cfg = config or DEFAULT_CONFIG
    e_cfg = cfg.energy
    effective_data_source = data_source or cfg.data_source_default

    # 1. Load and validate
    raw_df = load_dataset(energy_records, "energy_records")
    df, warnings = clean_energy_records(raw_df)

    if df.empty:
        return {
            "alerts": [],
            "warnings": warnings + ["No valid energy records available for analysis."],
            "trends": {},
            "machine_summaries": {},
        }

    # Add machine type if missing
    if "machine_type" not in df.columns:
        df["machine_type"] = df.apply(
            lambda r: extract_machine_type(r.get("machine_name", ""), r.get("machine_id", "")),
            axis=1,
        )

    alerts: List[Dict[str, Any]] = []
    machine_summaries: Dict[str, Any] = {}
    alert_sequence = 1

    # Date range for period
    min_date = df["date"].min()
    max_date = df["date"].max()

    # 2. Analyze per machine
    for machine_id, m_df in df.groupby("machine_id"):
        m_df = m_df.sort_values("date").reset_index(drop=True)
        m_name = m_df["machine_name"].iloc[-1]
        m_type = m_df["machine_type"].iloc[-1]
        total_records = len(m_df)

        latest_record = m_df.iloc[-1]
        latest_date = latest_record["date"]
        latest_kwh = float(latest_record["energy_kwh"])

        # History before the latest record for baseline calculation
        history_df = m_df.iloc[:-1] if total_records > 1 else pd.DataFrame()
        history_series = history_df["energy_kwh"] if not history_df.empty else pd.Series(dtype=float)

        # Baseline calculation
        baseline_val, baseline_status = calculate_baseline(
            history_series,
            window=e_cfg.baseline_window_days,
            method=e_cfg.baseline_method,
            min_records=e_cfg.min_history_records,
        )

        trend_info = calculate_linear_trend(m_df["date"], m_df["energy_kwh"])

        # Specific energy consumption normalization if optional columns present
        kwh_per_hour = None
        if "runtime_hours" in latest_record and pd.notna(latest_record["runtime_hours"]):
            rt = float(latest_record["runtime_hours"])
            if rt > 0:
                kwh_per_hour = round(latest_kwh / rt, 2)

        kwh_per_unit = None
        if "production_units" in latest_record and pd.notna(latest_record["production_units"]):
            pu = float(latest_record["production_units"])
            if pu > 0:
                kwh_per_unit = round(latest_kwh / pu, 4)

        m_summary = {
            "machine_id": machine_id,
            "machine_name": m_name,
            "machine_type": m_type,
            "total_records": total_records,
            "latest_kwh": latest_kwh,
            "baseline_kwh": baseline_val,
            "baseline_status": baseline_status,
            "trend": trend_info,
            "kwh_per_hour": kwh_per_hour,
            "kwh_per_unit": kwh_per_unit,
        }
        machine_summaries[machine_id] = m_summary

        if baseline_val is None:
            warnings.append(
                f"Machine {machine_id} ({m_name}): Insufficient history ({len(history_series)} records found, {e_cfg.min_history_records} required). Baseline marked 'INSUFFICIENT_BASELINE'."
            )
            continue

        # Deviation and robust z-score
        pct_increase = calculate_percentage_increase(
            actual=latest_kwh,
            baseline=baseline_val,
            epsilon=e_cfg.divide_by_zero_epsilon,
        )

        robust_z, med, mad = calculate_robust_zscore(
            value=latest_kwh,
            history=history_series,
            epsilon=e_cfg.divide_by_zero_epsilon,
        )

        # Optional IsolationForest check
        ml_flag = None
        if e_cfg.enable_isolation_forest:
            ml_flag = run_isolation_forest_check(
                values=m_df["energy_kwh"],
                latest_value=latest_kwh,
                contamination=e_cfg.isolation_forest_contamination,
                min_samples=e_cfg.isolation_forest_min_samples,
                random_seed=e_cfg.random_seed,
            )

        # Severity determination
        # Thresholds: >=50% -> HIGH, >=30% -> MEDIUM, >=15% -> LOW
        severity = None
        if pct_increase >= e_cfg.threshold_high_pct:
            severity = "HIGH"
        elif pct_increase >= e_cfg.threshold_med_pct:
            severity = "MEDIUM"
        elif pct_increase >= e_cfg.threshold_low_pct:
            severity = "LOW"
        elif robust_z >= e_cfg.robust_zscore_threshold:
            severity = "MEDIUM"

        if severity:
            rec_text = generate_energy_recommendation(
                machine_name=m_name,
                actual_kwh=latest_kwh,
                baseline_kwh=baseline_val,
                deviation_pct=pct_increase,
                severity=severity,
                unit="kWh",
            )

            explanation_parts = [
                f"Actual consumption ({latest_kwh:.1f} kWh) is {pct_increase:+.1f}% above the {e_cfg.baseline_window_days}-day rolling {e_cfg.baseline_method} baseline ({baseline_val:.1f} kWh).",
                f"Robust Z-Score: {robust_z:.2f} (MAD: {mad:.2f}, Median: {med:.1f} kWh).",
                f"Exceeds {severity.lower()} severity threshold (+{getattr(e_cfg, f'threshold_{severity.lower()[:3]}_pct', e_cfg.threshold_low_pct):.0f}%).",
            ]
            if kwh_per_hour is not None:
                explanation_parts.append(f"Normalized runtime efficiency: {kwh_per_hour:.2f} kWh/hour.")
            if kwh_per_unit is not None:
                explanation_parts.append(f"Normalized production efficiency: {kwh_per_unit:.4f} kWh/unit.")
            if ml_flag is not None:
                explanation_parts.append(f"IsolationForest secondary confirmation: {'Anomalous' if ml_flag else 'Normal'}.")

            alert = build_alert(
                category="ENERGY",
                title=f"Excessive Energy Consumption: {m_name}",
                severity=severity,
                affected_equipment=m_name,
                detected_value=latest_kwh,
                expected_value=baseline_val,
                unit="kWh",
                deviation_percent=pct_increase,
                explanation=" ".join(explanation_parts),
                recommendation=rec_text,
                period_start=str(latest_date),
                period_end=str(latest_date),
                data_source=effective_data_source,
                confidence_note=f"Baseline established from {len(history_series)} historical records via rolling {e_cfg.baseline_method}.",
                sequence=alert_sequence,
            )
            alert_sequence += 1
            alerts.append(alert)

    # 3. Peer machine comparison
    peer_comparisons: Dict[str, Any] = {}
    for m_type, group_df in df.groupby("machine_type"):
        machines_in_type = group_df["machine_id"].unique()
        if len(machines_in_type) > 1:
            type_latest = group_df[group_df["date"] == max_date]
            if not type_latest.empty:
                avg_kwh = float(type_latest["energy_kwh"].mean())
                peer_comparisons[m_type] = {
                    "peer_count": len(machines_in_type),
                    "peer_latest_mean_kwh": round(avg_kwh, 2),
                    "machines": type_latest[["machine_id", "machine_name", "energy_kwh"]].to_dict(orient="records"),
                }

    # 4. Plant Daily & Weekly Trends
    daily_totals = df.groupby("date")["energy_kwh"].sum().reset_index()
    daily_totals = daily_totals.sort_values("date").reset_index(drop=True)
    daily_trend = calculate_linear_trend(daily_totals["date"], daily_totals["energy_kwh"])

    top_consumers = (
        df.groupby(["machine_id", "machine_name"])["energy_kwh"]
        .sum()
        .reset_index()
        .sort_values("energy_kwh", ascending=False)
        .head(5)
        .to_dict(orient="records")
    )

    trends = {
        "period_start": str(min_date),
        "period_end": str(max_date),
        "plant_total_kwh": round(float(df["energy_kwh"].sum()), 2),
        "daily_trend": daily_trend,
        "daily_breakdown": [
            {"date": str(r["date"]), "total_kwh": round(float(r["energy_kwh"]), 2)}
            for _, r in daily_totals.iterrows()
        ],
        "top_consumers": top_consumers,
        "peer_comparisons": peer_comparisons,
    }

    return {
        "alerts": alerts,
        "warnings": warnings,
        "trends": trends,
        "machine_summaries": machine_summaries,
    }
