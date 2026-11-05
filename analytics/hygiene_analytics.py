"""
Module 2: Hygiene Analytics for SMARTTRUST Dairy Plant Management System.
Evaluates sanitation adherence by comparing cleaning records against prescribed schedules.
Strictly adheres to honest reporting: evaluates RECORDED compliance only;
never states that equipment is or is not physically clean.
"""

from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .config import AnalyticsConfig, DEFAULT_CONFIG
from .formatter import build_alert
from .recommendations import generate_hygiene_recommendation
from .validation import clean_cleaning_records, clean_cleaning_schedule, load_dataset


def run_hygiene_analytics(
    cleaning_records: Union[pd.DataFrame, str, List[Dict[str, Any]]],
    cleaning_schedule: Union[pd.DataFrame, str, List[Dict[str, Any]]],
    config: Optional[AnalyticsConfig] = None,
    data_source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes Hygiene Analytics. Computes submitted and verified compliance,
    detects repeated incomplete/missing sessions, and generates sanitation alerts.
    """
    cfg = config or DEFAULT_CONFIG
    h_cfg = cfg.hygiene
    effective_data_source = data_source or cfg.data_source_default

    # 1. Load and validate
    raw_rec = load_dataset(cleaning_records, "cleaning_records")
    clean_rec, warnings_rec = clean_cleaning_records(raw_rec)

    raw_sch = load_dataset(cleaning_schedule, "cleaning_schedule")
    clean_sch, warnings_sch = clean_cleaning_schedule(raw_sch)

    warnings = warnings_rec + warnings_sch

    if clean_rec.empty or clean_sch.empty:
        return {
            "alerts": [],
            "warnings": warnings + ["Cleaning records or schedule is empty; hygiene analysis skipped."],
            "equipment_compliance": {},
            "overall_compliance": {},
        }

    alerts: List[Dict[str, Any]] = []
    alert_sequence = 1

    # Date range for period
    min_date = clean_rec["date"].min()
    max_date = clean_rec["date"].max()
    period_days = max(1, (max_date - min_date).days + 1)

    equipment_compliance: Dict[str, Any] = {}
    total_required_plant = 0.0
    total_submitted_plant = 0
    total_verified_plant = 0

    # 2. Equipment-wise compliance
    for _, sch_row in clean_sch.iterrows():
        eq_id = sch_row["equipment_id"]
        eq_name = sch_row["equipment_name"]
        freq_type = str(sch_row.get("required_frequency", "daily")).strip().lower()
        freq_count = float(sch_row["required_times_per_period"])

        # Determine expected sessions across observed period
        if "shift" in freq_type:
            # 3 shifts per day typical in dairy processing
            expected_sessions = freq_count * 3 * period_days
        elif "week" in freq_type:
            expected_sessions = freq_count * max(1.0, period_days / 7.0)
        else:
            # Default to daily
            expected_sessions = freq_count * period_days

        expected_sessions = max(1.0, round(expected_sessions, 1))

        # Filter records for this equipment
        eq_recs = clean_rec[clean_rec["equipment_id"] == eq_id].sort_values("date")
        actual_total = len(eq_recs)

        # Submitted compliance includes statuses 'submitted' and 'verified'
        submitted_count = len(eq_recs[eq_recs["status"].isin(["submitted", "verified"])])
        # Verified compliance includes only status 'verified'
        verified_count = len(eq_recs[eq_recs["status"] == "verified"])
        incomplete_count = len(eq_recs[eq_recs["status"] == "incomplete"])
        missed_count = len(eq_recs[eq_recs["status"] == "missed"])
        recorded_gaps = max(0, int(expected_sessions - submitted_count))

        submitted_comp_pct = min(100.0, (submitted_count / expected_sessions) * 100.0)
        verified_comp_pct = min(100.0, (verified_count / expected_sessions) * 100.0)

        total_required_plant += expected_sessions
        total_submitted_plant += submitted_count
        total_verified_plant += verified_count

        equipment_compliance[eq_id] = {
            "equipment_id": eq_id,
            "equipment_name": eq_name,
            "required_frequency": freq_type,
            "expected_sessions": expected_sessions,
            "recorded_sessions": actual_total,
            "submitted_sessions": submitted_count,
            "verified_sessions": verified_count,
            "incomplete_sessions": incomplete_count,
            "missed_sessions": missed_count,
            "missing_gap_sessions": recorded_gaps,
            "submitted_compliance_percent": round(submitted_comp_pct, 1),
            "verified_compliance_percent": round(verified_comp_pct, 1),
        }

        # Check compliance band against submitted_comp_pct
        comp_severity = None
        if submitted_comp_pct < h_cfg.compliance_band_critical:
            comp_severity = "CRITICAL"
        elif submitted_comp_pct < h_cfg.compliance_band_high:
            comp_severity = "HIGH"
        elif submitted_comp_pct < h_cfg.compliance_band_medium:
            comp_severity = "MEDIUM"
        elif submitted_comp_pct < h_cfg.compliance_band_low:
            comp_severity = "LOW"

        if comp_severity:
            rec_text = generate_hygiene_recommendation(
                equipment_name=eq_name,
                compliance_pct=submitted_comp_pct,
                missed_count=recorded_gaps,
                severity=comp_severity,
                is_repeated_pattern=False,
            )

            explanation = (
                f"Plant records indicate recorded cleaning compliance is {submitted_comp_pct:.1f}% "
                f"({submitted_count} submitted/verified sessions out of {expected_sessions:.0f} expected recorded sessions). "
                f"Verified compliance is {verified_comp_pct:.1f}% ({verified_count}/{expected_sessions:.0f}). "
                f"Identified {recorded_gaps} missing or incomplete recorded sessions against schedule. "
                f"Falls into {comp_severity} severity band (< {getattr(h_cfg, f'compliance_band_{comp_severity.lower()}', h_cfg.compliance_band_low):.0f}%)."
            )

            alert = build_alert(
                category="HYGIENE",
                title=f"Sub-Optimal Sanitation Record Compliance: {eq_name}",
                severity=comp_severity,
                affected_equipment=eq_name,
                detected_value=submitted_comp_pct,
                expected_value=100.0,
                unit="%",
                deviation_percent=round(100.0 - submitted_comp_pct, 1),
                explanation=explanation,
                recommendation=rec_text,
                period_start=str(min_date),
                period_end=str(max_date),
                data_source=effective_data_source,
                confidence_note=f"Calculated from {actual_total} recorded sessions over a {period_days}-day period against prescribed {freq_type} schedule.",
                sequence=alert_sequence,
            )
            alert_sequence += 1
            alerts.append(alert)

        # 3. Detect Repeated Incomplete or Missed Records (Rolling Window)
        problematic_recs = eq_recs[eq_recs["status"].isin(["incomplete", "missed"])].sort_values("date")
        if len(problematic_recs) >= h_cfg.repeated_missed_threshold_count:
            # Check rolling window
            window_days = timedelta(days=h_cfg.repeated_missed_window_days)
            has_repeated = False
            window_count = 0
            dates_list = problematic_recs["date"].tolist()

            for i in range(len(dates_list)):
                curr_date = dates_list[i]
                sub_dates = [d for d in dates_list if curr_date <= d <= curr_date + window_days]
                if len(sub_dates) >= h_cfg.repeated_missed_threshold_count:
                    has_repeated = True
                    window_count = len(sub_dates)
                    break

            if has_repeated:
                repeated_rec_text = generate_hygiene_recommendation(
                    equipment_name=eq_name,
                    compliance_pct=submitted_comp_pct,
                    missed_count=window_count,
                    severity="HIGH",
                    is_repeated_pattern=True,
                )

                repeated_explanation = (
                    f"Equipment cleaning records indicate repeated incomplete or missed sessions: "
                    f"{window_count} recorded non-compliances within a {h_cfg.repeated_missed_window_days}-day rolling window "
                    f"(threshold is {h_cfg.repeated_missed_threshold_count}). "
                    f"Wording notice: findings reflect recorded logs only and do not constitute physical inspection."
                )

                repeated_alert = build_alert(
                    category="HYGIENE",
                    title=f"Repeated Missing Sanitation Records: {eq_name}",
                    severity="HIGH",
                    affected_equipment=eq_name,
                    detected_value=window_count,
                    expected_value=0.0,
                    unit="sessions",
                    deviation_percent=100.0,
                    explanation=repeated_explanation,
                    recommendation=repeated_rec_text,
                    period_start=str(min_date),
                    period_end=str(max_date),
                    data_source=effective_data_source,
                    confidence_note=f"Detected across {len(eq_recs)} recorded logs. Records indicate recurring documentation gaps.",
                    sequence=alert_sequence,
                )
                alert_sequence += 1
                alerts.append(repeated_alert)

    # Overall plant-level hygiene compliance
    overall_expected = max(1.0, total_required_plant)
    overall_submitted_pct = min(100.0, (total_submitted_plant / overall_expected) * 100.0)
    overall_verified_pct = min(100.0, (total_verified_plant / overall_expected) * 100.0)

    overall_compliance = {
        "period_start": str(min_date),
        "period_end": str(max_date),
        "total_required_sessions": round(total_required_plant, 1),
        "total_submitted_sessions": total_submitted_plant,
        "total_verified_sessions": total_verified_plant,
        "overall_submitted_compliance_percent": round(overall_submitted_pct, 1),
        "overall_verified_compliance_percent": round(overall_verified_pct, 1),
    }

    return {
        "alerts": alerts,
        "warnings": warnings,
        "equipment_compliance": equipment_compliance,
        "overall_compliance": overall_compliance,
    }
