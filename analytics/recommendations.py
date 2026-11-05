"""
AI Insights Recommendation Engine for SMARTTRUST Dairy Plant Analytics.
Template- and rule-based recommendation engine mapping (category, pattern, severity)
to explainable, plain-language recommendations citing exact numbers.
No runtime LLM dependency.
"""

from typing import Any, Dict, List, Optional


def generate_energy_recommendation(
    machine_name: str,
    actual_kwh: float,
    baseline_kwh: float,
    deviation_pct: float,
    severity: str,
    unit: str = "kWh",
) -> str:
    """Generates energy recommendation strictly adhering to reference style."""
    lower_name = machine_name.lower()
    equipment_display = machine_name if "chiller" in lower_name or "boiler" in lower_name or "pasteurizer" in lower_name else f"{machine_name} equipment"

    if severity in ("HIGH", "CRITICAL"):
        # Matches exact reference: "Chiller consumption is significantly higher than its historical baseline. Inspect the equipment."
        return f"{equipment_display} consumption is significantly higher than its historical baseline ({actual_kwh:.1f} vs baseline {baseline_kwh:.1f} {unit}, +{deviation_pct:.1f}%). Inspect the equipment."
    elif severity == "MEDIUM":
        return f"{equipment_display} consumption is moderately higher than historical baseline ({actual_kwh:.1f} vs baseline {baseline_kwh:.1f} {unit}, +{deviation_pct:.1f}%). Review operating parameters and load distribution."
    else:
        return f"{equipment_display} consumption shows minor elevation over baseline (+{deviation_pct:.1f}%). Continue regular monitoring."


def generate_hygiene_recommendation(
    equipment_name: str,
    compliance_pct: float,
    missed_count: int,
    severity: str,
    is_repeated_pattern: bool = False,
) -> str:
    """Generates hygiene recommendation strictly adhering to reference style and wording rules."""
    lower_name = equipment_name.lower()
    equipment_display = equipment_name if "pasteurizer" in lower_name or "tank" in lower_name or "separator" in lower_name else f"{equipment_name} equipment"

    if is_repeated_pattern or missed_count >= 3:
        # Matches exact reference: "Pasteurizer cleaning records show repeated missing sessions. Supervisor review is recommended."
        return f"{equipment_display} cleaning records show repeated missing sessions ({missed_count} incomplete or missed records). Supervisor review is recommended."
    elif severity in ("HIGH", "CRITICAL"):
        return f"{equipment_display} cleaning records indicate recorded compliance of {compliance_pct:.1f}%. Immediate supervisor audit of sanitation logs is recommended."
    elif severity == "MEDIUM":
        return f"{equipment_display} cleaning records indicate sub-optimal compliance ({compliance_pct:.1f}%). Reconcile shift handoff records."
    else:
        return f"{equipment_display} cleaning records indicate minor gaps ({compliance_pct:.1f}% compliance). Ensure all completed sessions are verified."


def generate_waste_recommendation(
    material_or_product: str,
    variance_pct: float,
    waste_type: str,  # 'PACKAGING' or 'MILK_LOSS'
    candidate_reasons: Optional[List[str]] = None,
) -> str:
    """Generates waste recommendation strictly adhering to reference style and investigation rules."""
    reasons_str = ", ".join(candidate_reasons or ["damaged packaging", "rejected items", "recording errors"])

    if waste_type == "PACKAGING":
        # Matches exact reference: "Packaging material usage exceeds the expected production-based quantity. Investigate damaged and rejected packaging."
        return f"Packaging material usage exceeds the expected production-based quantity (+{variance_pct:.1f}%). Investigate {reasons_str}."
    elif waste_type == "MILK_LOSS":
        return f"Milk loss for {material_or_product} is elevated ({variance_pct:.1f}% loss). Inspect transfer piping, valve seals, and separator discharge for leaks or shrinkage."
    else:
        return f"Material usage for {material_or_product} deviates by {variance_pct:.1f}%. Flagged for supervisor investigation."


def generate_executive_summary(
    alerts: List[Dict[str, Any]],
    summary_counts: Dict[str, Any],
) -> str:
    """
    Produces a plain-text executive summary highlighting top alerts by severity
    and aggregate counts per operational category.
    """
    total = summary_counts.get("total_alerts", len(alerts))
    by_cat = summary_counts.get("by_category", {})
    by_sev = summary_counts.get("by_severity", {})

    lines: List[str] = [
        "SMARTTRUST DAIRY PLANT ANALYTICS - EXECUTIVE SUMMARY",
        "=====================================================",
        f"Total Alerts Flagged for Review: {total}",
        f"Breakdown by Category: Energy: {by_cat.get('ENERGY', 0)} | Hygiene: {by_cat.get('HYGIENE', 0)} | Waste: {by_cat.get('WASTE', 0)}",
        f"Breakdown by Severity: Critical: {by_sev.get('CRITICAL', 0)} | High: {by_sev.get('HIGH', 0)} | Medium: {by_sev.get('MEDIUM', 0)} | Low: {by_sev.get('LOW', 0)}",
        "",
        "Key Operational Inefficiencies Requiring Investigation:",
    ]

    # Prioritize CRITICAL and HIGH severity alerts
    priority_alerts = [a for a in alerts if a.get("severity") in ("CRITICAL", "HIGH")]
    if not priority_alerts:
        priority_alerts = alerts[:5]
    else:
        priority_alerts = priority_alerts[:5]

    if not priority_alerts:
        lines.append("No critical or high-severity inefficiencies detected across records.")
    else:
        for idx, alert in enumerate(priority_alerts, 1):
            lines.append(
                f"{idx}. [{alert.get('severity')}] {alert.get('title')}: {alert.get('recommendation')}"
            )

    lines.append("")
    lines.append("Note: All findings are derived from historical plant records and are flagged for human investigation.")
    return "\n".join(lines)
