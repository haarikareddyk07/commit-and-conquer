"""
Module 3: Waste Analytics for SMARTTRUST Dairy Plant Management System.
Analyzes milk processing losses and packaging material reconciliation.
Strictly adheres to honest reporting: excess usage is NEVER auto-classified
as confirmed waste, but marked 'FLAGGED_FOR_INVESTIGATION' with candidate causes.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .config import AnalyticsConfig, DEFAULT_CONFIG
from .formatter import build_alert
from .recommendations import generate_waste_recommendation
from .validation import (
    clean_milk_loss_records,
    clean_packaging_records,
    clean_production_records,
    load_dataset,
)


def run_waste_analytics(
    production_records: Union[pd.DataFrame, str, List[Dict[str, Any]]],
    milk_loss_records: Optional[Union[pd.DataFrame, str, List[Dict[str, Any]]]] = None,
    packaging_records: Optional[Union[pd.DataFrame, str, List[Dict[str, Any]]]] = None,
    config: Optional[AnalyticsConfig] = None,
    data_source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes Waste Analytics across milk loss and packaging reconciliation.
    """
    cfg = config or DEFAULT_CONFIG
    w_cfg = cfg.waste
    effective_data_source = data_source or cfg.data_source_default
    warnings: List[str] = []
    alerts: List[Dict[str, Any]] = []
    alert_sequence = 1

    # 1. Load and validate production records
    raw_prod = load_dataset(production_records, "production_records")
    clean_prod, warn_prod = clean_production_records(raw_prod)
    warnings.extend(warn_prod)

    if clean_prod.empty:
        return {
            "alerts": [],
            "warnings": warnings + ["Production records are empty; waste analysis cannot proceed."],
            "milk_loss_summary": {},
            "packaging_reconciliation": {},
        }

    period_start = str(clean_prod["date"].min())
    period_end = str(clean_prod["date"].max())

    # 2. Milk Loss Analytics
    batch_milk_losses: List[Dict[str, Any]] = []
    daily_milk_losses: List[Dict[str, Any]] = []
    product_milk_losses: List[Dict[str, Any]] = []
    overall_milk_summary: Dict[str, Any] = {}

    if milk_loss_records is not None:
        raw_loss = load_dataset(milk_loss_records, "milk_loss_records")
        clean_loss, warn_loss = clean_milk_loss_records(raw_loss)
        warnings.extend(warn_loss)

        if not clean_loss.empty:
            # Merge with production records on batch_id
            merged_loss = pd.merge(
                clean_prod,
                clean_loss,
                on="batch_id",
                how="inner",
                suffixes=("_prod", "_loss"),
            )

            if merged_loss.empty:
                warnings.append(
                    "No matching batch_id found between production_records and milk_loss_records."
                )
            else:
                for _, row in merged_loss.iterrows():
                    batch_id = row["batch_id"]
                    p_type = row["product_type"]
                    b_date = str(row["date_prod"])
                    m_input = float(row["milk_input_litres"])
                    loss_litres = float(row["loss_litres"])

                    # Divide-by-zero safe calculation
                    safe_input = m_input if m_input > w_cfg.divide_by_zero_epsilon else w_cfg.divide_by_zero_epsilon
                    loss_pct = (loss_litres / safe_input) * 100.0

                    batch_milk_losses.append({
                        "batch_id": batch_id,
                        "date": b_date,
                        "product_type": p_type,
                        "milk_input_litres": m_input,
                        "loss_litres": loss_litres,
                        "loss_percent": round(loss_pct, 2),
                    })

                    # Check milk loss thresholds
                    severity = None
                    if loss_pct >= w_cfg.milk_loss_pct_critical:
                        severity = "CRITICAL"
                    elif loss_pct >= w_cfg.milk_loss_pct_high:
                        severity = "HIGH"
                    elif loss_pct >= w_cfg.milk_loss_pct_med:
                        severity = "MEDIUM"
                    elif loss_pct >= w_cfg.milk_loss_pct_low:
                        severity = "LOW"

                    if severity:
                        rec = generate_waste_recommendation(
                            material_or_product=f"{p_type} (Batch {batch_id})",
                            variance_pct=loss_pct,
                            waste_type="MILK_LOSS",
                        )
                        explanation = (
                            f"Recorded milk loss for batch {batch_id} ({p_type}) is {loss_litres:,.1f} litres "
                            f"on {m_input:,.1f} litres input ({loss_pct:.2f}% loss). "
                            f"Exceeds {severity.lower()} loss threshold ({getattr(w_cfg, f'milk_loss_pct_{severity.lower()[:3]}', w_cfg.milk_loss_pct_low):.1f}%)."
                        )
                        alert = build_alert(
                            category="WASTE",
                            title=f"Elevated Milk Loss: {p_type} (Batch {batch_id})",
                            severity=severity,
                            affected_equipment=f"{p_type} Processing Line",
                            detected_value=loss_pct,
                            expected_value=0.0,
                            unit="%",
                            deviation_percent=round(loss_pct, 2),
                            explanation=explanation,
                            recommendation=rec,
                            period_start=b_date,
                            period_end=b_date,
                            data_source=effective_data_source,
                            confidence_note=f"Calculated from batch records ({loss_litres:,.1f}L lost / {m_input:,.1f}L input).",
                            sequence=alert_sequence,
                        )
                        alert_sequence += 1
                        alerts.append(alert)

                # Aggregations by product type
                loss_df = pd.DataFrame(batch_milk_losses)
                for p_type, p_df in loss_df.groupby("product_type"):
                    tot_in = p_df["milk_input_litres"].sum()
                    tot_loss = p_df["loss_litres"].sum()
                    pct = (tot_loss / max(tot_in, w_cfg.divide_by_zero_epsilon)) * 100.0
                    product_milk_losses.append({
                        "product_type": p_type,
                        "total_input_litres": round(float(tot_in), 2),
                        "total_loss_litres": round(float(tot_loss), 2),
                        "overall_loss_percent": round(float(pct), 2),
                    })

                # Aggregations by day
                for d_val, d_df in loss_df.groupby("date"):
                    tot_in = d_df["milk_input_litres"].sum()
                    tot_loss = d_df["loss_litres"].sum()
                    pct = (tot_loss / max(tot_in, w_cfg.divide_by_zero_epsilon)) * 100.0
                    daily_milk_losses.append({
                        "date": str(d_val),
                        "total_input_litres": round(float(tot_in), 2),
                        "total_loss_litres": round(float(tot_loss), 2),
                        "daily_loss_percent": round(float(pct), 2),
                    })

                total_plant_in = loss_df["milk_input_litres"].sum()
                total_plant_loss = loss_df["loss_litres"].sum()
                plant_loss_pct = (total_plant_loss / max(total_plant_in, w_cfg.divide_by_zero_epsilon)) * 100.0
                overall_milk_summary = {
                    "total_milk_input_litres": round(float(total_plant_in), 2),
                    "total_milk_loss_litres": round(float(total_plant_loss), 2),
                    "plant_milk_loss_percent": round(float(plant_loss_pct), 2),
                }
    else:
        warnings.append("milk_loss_records not provided; milk wastage analysis skipped.")

    # 3. Packaging Usage vs Expected Reconciliation
    pkg_summaries: List[Dict[str, Any]] = []
    if packaging_records is not None:
        raw_pkg = load_dataset(packaging_records, "packaging_records")
        clean_pkg, warn_pkg = clean_packaging_records(raw_pkg)
        warnings.extend(warn_pkg)

        if not clean_pkg.empty:
            # Finished output units from production records
            if "finished_output_units" in clean_prod.columns:
                total_output_units = float(clean_prod["finished_output_units"].dropna().sum())
            elif "finished_output_litres" in clean_prod.columns:
                # Fallback: estimate 1 unit per litre if units not explicitly given
                total_output_units = float(clean_prod["finished_output_litres"].dropna().sum())
                warnings.append(
                    "finished_output_units not provided; estimated 1 unit per finished_output_litre."
                )
            else:
                total_output_units = 0.0

            # Reconcile per material type
            for mat_type, mat_df in clean_pkg.groupby("material_type"):
                tot_issued = float(mat_df["issued_qty"].sum())
                tot_used = float(mat_df["used_qty"].sum())
                tot_damaged = float(mat_df["damaged_qty"].sum())
                tot_rejected = float(mat_df["rejected_qty"].sum())

                # Packaging ratio
                ratio = w_cfg.default_packaging_per_unit_ratio
                if "units_per_package_ratio" in mat_df.columns and pd.notna(mat_df["units_per_package_ratio"].iloc[0]):
                    ratio = float(mat_df["units_per_package_ratio"].iloc[0])

                # Expected quantity = finished_output_units * packaging_ratio
                expected_qty = max(0.0, total_output_units * ratio)

                # Damaged packaging % = damaged_qty / used_qty * 100
                safe_used = tot_used if tot_used > w_cfg.divide_by_zero_epsilon else w_cfg.divide_by_zero_epsilon
                damaged_pct = (tot_damaged / safe_used) * 100.0

                # Variance = used_qty - expected_qty
                variance_qty = tot_used - expected_qty
                safe_expected = expected_qty if expected_qty > w_cfg.divide_by_zero_epsilon else w_cfg.divide_by_zero_epsilon
                variance_pct = (variance_qty / safe_expected) * 100.0

                mat_summary = {
                    "material_type": mat_type,
                    "issued_qty": tot_issued,
                    "used_qty": tot_used,
                    "damaged_qty": tot_damaged,
                    "rejected_qty": tot_rejected,
                    "expected_qty": round(expected_qty, 2),
                    "variance_qty": round(variance_qty, 2),
                    "variance_percent": round(variance_pct, 2),
                    "damaged_percent": round(damaged_pct, 2),
                    "investigation_status": "NORMAL",
                    "candidate_explanations": [],
                }

                # Check if excess usage exists
                if variance_pct >= w_cfg.excess_pkg_pct_low:
                    # NEVER auto-classify as confirmed waste; must be FLAGGED_FOR_INVESTIGATION
                    mat_summary["investigation_status"] = "FLAGGED_FOR_INVESTIGATION"
                    mat_summary["candidate_explanations"] = w_cfg.candidate_investigation_reasons

                    severity = "LOW"
                    if variance_pct >= w_cfg.excess_pkg_pct_critical:
                        severity = "CRITICAL"
                    elif variance_pct >= w_cfg.excess_pkg_pct_high:
                        severity = "HIGH"
                    elif variance_pct >= w_cfg.excess_pkg_pct_med:
                        severity = "MEDIUM"

                    rec = generate_waste_recommendation(
                        material_or_product=mat_type,
                        variance_pct=variance_pct,
                        waste_type="PACKAGING",
                        candidate_reasons=w_cfg.candidate_investigation_reasons,
                    )

                    explanation = (
                        f"Packaging usage for '{mat_type}' recorded at {tot_used:,.0f} units, "
                        f"exceeding expected production requirement of {expected_qty:,.0f} units by {variance_qty:+,.0f} units (+{variance_pct:.1f}%). "
                        f"Damaged recorded: {tot_damaged:,.0f} ({damaged_pct:.1f}%), Rejected: {tot_rejected:,.0f}. "
                        f"Status: FLAGGED_FOR_INVESTIGATION (never classified as confirmed waste). "
                        f"Candidate explanations to check: {', '.join(w_cfg.candidate_investigation_reasons)}."
                    )

                    alert = build_alert(
                        category="WASTE",
                        title=f"Excess Packaging Material Usage: {mat_type}",
                        severity=severity,
                        affected_equipment=f"{mat_type} Packaging Line",
                        detected_value=tot_used,
                        expected_value=expected_qty,
                        unit="units",
                        deviation_percent=round(variance_pct, 2),
                        explanation=explanation,
                        recommendation=rec,
                        period_start=period_start,
                        period_end=period_end,
                        data_source=effective_data_source,
                        confidence_note=(
                            f"Reconciled against {total_output_units:,.0f} finished output units "
                            f"(ratio {ratio:.2f}). Marked FLAGGED_FOR_INVESTIGATION."
                        ),
                        sequence=alert_sequence,
                    )
                    alert_sequence += 1
                    alerts.append(alert)

                pkg_summaries.append(mat_summary)
    else:
        warnings.append("packaging_records not provided; packaging reconciliation skipped.")

    return {
        "alerts": alerts,
        "warnings": warnings,
        "milk_loss_summary": {
            "batch_losses": batch_milk_losses,
            "daily_losses": daily_milk_losses,
            "product_losses": product_milk_losses,
            "overall": overall_milk_summary,
        },
        "packaging_reconciliation": {
            "period_start": period_start,
            "period_end": period_end,
            "materials": pkg_summaries,
        },
    }
