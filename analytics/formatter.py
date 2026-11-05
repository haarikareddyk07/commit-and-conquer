"""
Alert and Analytics output formatter for SMARTTRUST.
Enforces standard alert schemas, calculates deterministic alert IDs,
and aggregates top-level summaries and warnings.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional


def create_deterministic_alert_id(
    category: str,
    equipment_or_target: Optional[str],
    period_start: str,
    sequence: int = 1,
) -> str:
    """
    Creates a deterministic alert ID, e.g. ENERGY-CHILLER01-2026-11-05-01.
    """
    clean_target = re.sub(r"[^A-Za-z0-9]", "", str(equipment_or_target or "PLANT")).upper()
    clean_date = str(period_start).replace("-", "")
    return f"{category.upper()}-{clean_target}-{clean_date}-{sequence:02d}"


def build_alert(
    category: str,
    title: str,
    severity: str,
    affected_equipment: Optional[str],
    detected_value: float,
    expected_value: Optional[float],
    unit: str,
    deviation_percent: Optional[float],
    explanation: str,
    recommendation: str,
    period_start: str,
    period_end: str,
    data_source: str = "REAL",
    confidence_note: str = "",
    sequence: int = 1,
) -> Dict[str, Any]:
    """
    Constructs an alert dictionary strictly complying with Module 5 schema.
    """
    alert_id = create_deterministic_alert_id(
        category=category,
        equipment_or_target=affected_equipment,
        period_start=period_start,
        sequence=sequence,
    )

    return {
        "alert_id": alert_id,
        "title": title,
        "category": category,  # ENERGY | HYGIENE | WASTE
        "severity": severity,  # LOW | MEDIUM | HIGH | CRITICAL
        "affected_equipment": affected_equipment,
        "detected_value": round(float(detected_value), 2) if detected_value is not None else None,
        "expected_value": round(float(expected_value), 2) if expected_value is not None else None,
        "unit": unit,
        "deviation_percent": round(float(deviation_percent), 2) if deviation_percent is not None else None,
        "explanation": explanation,
        "recommendation": recommendation,
        "period": {
            "start": str(period_start),
            "end": str(period_end),
        },
        "data_source": data_source,
        "confidence_note": confidence_note,
    }


def format_analytics_response(
    alerts: List[Dict[str, Any]],
    warnings: Optional[List[str]] = None,
    data_source: str = "REAL",
    executive_summary: Optional[str] = None,
    module_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Wraps module alerts, executive summary, warnings, and summary stats
    into the standard top-level JSON response.
    """
    warnings_list = warnings or []

    # Calculate summary metrics
    by_category = {"ENERGY": 0, "HYGIENE": 0, "WASTE": 0}
    by_severity = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

    for alert in alerts:
        cat = alert.get("category", "")
        sev = alert.get("severity", "")
        if cat in by_category:
            by_category[cat] += 1
        if sev in by_severity:
            by_severity[sev] += 1

    summary = {
        "total_alerts": len(alerts),
        "by_category": by_category,
        "by_severity": by_severity,
    }

    # Timestamp in ISO format with UTC
    now_iso = datetime.now(timezone.utc).isoformat()

    response: Dict[str, Any] = {
        "status": "SUCCESS",
        "generation_timestamp": now_iso,
        "data_source": data_source,
        "summary": summary,
        "executive_summary": executive_summary or "",
        "alerts": alerts,
        "warnings": warnings_list,
    }

    if module_details:
        response["details"] = module_details

    return response
