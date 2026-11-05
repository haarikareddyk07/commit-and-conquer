"""
Core Orchestration Engine for SMARTTRUST Dairy Plant Analytics.
Provides unified and per-module entry points.
"""

from typing import Any, Dict, List, Optional
import pandas as pd

from .config import AnalyticsConfig, DEFAULT_CONFIG
from .energy_analytics import run_energy_analytics
from .formatter import format_analytics_response
from .hygiene_analytics import run_hygiene_analytics
from .recommendations import generate_executive_summary
from .waste_analytics import run_waste_analytics


def run_analytics(
    inputs: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for SMARTTRUST Analytics Engine.
    Executes energy, hygiene, and waste analytics on historical plant records.

    :param inputs: Dictionary containing plant dataset records:
                   - 'energy_records' (DataFrame, CSV string, or record dicts)
                   - 'cleaning_schedule'
                   - 'cleaning_records'
                   - 'production_records'
                   - 'milk_loss_records' (optional)
                   - 'packaging_records' (optional)
                   - 'data_source' ('REAL' or 'SIMULATED', default: 'REAL')
    :param config: Optional dictionary overriding default configuration thresholds.
    :return: Standardized JSON dictionary with alerts, executive summary, warnings, and metrics.
    """
    cfg = AnalyticsConfig.from_dict(config) if config else DEFAULT_CONFIG
    data_source = inputs.get("data_source", cfg.data_source_default)

    all_alerts: List[Dict[str, Any]] = []
    all_warnings: List[str] = []
    module_details: Dict[str, Any] = {}

    # 1. Energy Analytics
    if "energy_records" in inputs and inputs["energy_records"] is not None:
        energy_res = run_energy_analytics(
            energy_records=inputs["energy_records"],
            config=cfg,
            data_source=data_source,
        )
        all_alerts.extend(energy_res.get("alerts", []))
        all_warnings.extend(energy_res.get("warnings", []))
        module_details["energy"] = {
            "trends": energy_res.get("trends", {}),
            "machine_summaries": energy_res.get("machine_summaries", {}),
        }
    else:
        all_warnings.append("energy_records omitted from inputs; energy analysis skipped.")

    # 2. Hygiene Analytics
    if "cleaning_records" in inputs and "cleaning_schedule" in inputs and inputs["cleaning_records"] is not None and inputs["cleaning_schedule"] is not None:
        hygiene_res = run_hygiene_analytics(
            cleaning_records=inputs["cleaning_records"],
            cleaning_schedule=inputs["cleaning_schedule"],
            config=cfg,
            data_source=data_source,
        )
        all_alerts.extend(hygiene_res.get("alerts", []))
        all_warnings.extend(hygiene_res.get("warnings", []))
        module_details["hygiene"] = {
            "equipment_compliance": hygiene_res.get("equipment_compliance", {}),
            "overall_compliance": hygiene_res.get("overall_compliance", {}),
        }
    else:
        all_warnings.append("cleaning_records or cleaning_schedule omitted; hygiene analysis skipped.")

    # 3. Waste Analytics
    if "production_records" in inputs and inputs["production_records"] is not None:
        waste_res = run_waste_analytics(
            production_records=inputs["production_records"],
            milk_loss_records=inputs.get("milk_loss_records"),
            packaging_records=inputs.get("packaging_records"),
            config=cfg,
            data_source=data_source,
        )
        all_alerts.extend(waste_res.get("alerts", []))
        all_warnings.extend(waste_res.get("warnings", []))
        module_details["waste"] = {
            "milk_loss_summary": waste_res.get("milk_loss_summary", {}),
            "packaging_reconciliation": waste_res.get("packaging_reconciliation", {}),
        }
    else:
        all_warnings.append("production_records omitted; waste analysis skipped.")

    # Sort alerts by severity priority: CRITICAL > HIGH > MEDIUM > LOW
    sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    all_alerts.sort(key=lambda a: sev_rank.get(a.get("severity", "LOW"), 4))

    # Calculate preliminary summary counts for executive summary
    by_category = {"ENERGY": 0, "HYGIENE": 0, "WASTE": 0}
    by_severity = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for alert in all_alerts:
        c = alert.get("category", "")
        s = alert.get("severity", "")
        if c in by_category:
            by_category[c] += 1
        if s in by_severity:
            by_severity[s] += 1

    summary_counts = {
        "total_alerts": len(all_alerts),
        "by_category": by_category,
        "by_severity": by_severity,
    }

    # Generate executive summary
    exec_summary = generate_executive_summary(all_alerts, summary_counts)

    # Format final output response
    return format_analytics_response(
        alerts=all_alerts,
        warnings=all_warnings,
        data_source=data_source,
        executive_summary=exec_summary,
        module_details=module_details,
    )
