"""
Unit tests for AI Insights recommendation engine and executive summary.
"""

from ..recommendations import (
    generate_energy_recommendation,
    generate_executive_summary,
    generate_hygiene_recommendation,
    generate_waste_recommendation,
)


def test_reference_output_styles():
    # 1. Energy
    energy_rec = generate_energy_recommendation(
        machine_name="Chiller",
        actual_kwh=150.0,
        baseline_kwh=100.0,
        deviation_pct=50.0,
        severity="HIGH",
    )
    assert "Chiller consumption is significantly higher than its historical baseline" in energy_rec
    assert "Inspect the equipment" in energy_rec

    # 2. Hygiene
    hygiene_rec = generate_hygiene_recommendation(
        equipment_name="Pasteurizer",
        compliance_pct=60.0,
        missed_count=3,
        severity="HIGH",
        is_repeated_pattern=True,
    )
    assert "Pasteurizer cleaning records show repeated missing sessions" in hygiene_rec
    assert "Supervisor review is recommended" in hygiene_rec

    # 3. Waste
    waste_rec = generate_waste_recommendation(
        material_or_product="HDPE Pouch",
        variance_pct=25.0,
        waste_type="PACKAGING",
        candidate_reasons=["damaged and rejected packaging"],
    )
    assert "Packaging material usage exceeds the expected production-based quantity" in waste_rec
    assert "Investigate damaged and rejected packaging" in waste_rec


def test_executive_summary_formatting():
    mock_alerts = [
        {
            "title": "Chiller High Energy",
            "category": "ENERGY",
            "severity": "HIGH",
            "recommendation": "Inspect chiller compressor.",
        },
        {
            "title": "Pasteurizer Missing Sessions",
            "category": "HYGIENE",
            "severity": "CRITICAL",
            "recommendation": "Supervisor audit needed.",
        },
    ]
    summary_counts = {
        "total_alerts": 2,
        "by_category": {"ENERGY": 1, "HYGIENE": 1, "WASTE": 0},
        "by_severity": {"CRITICAL": 1, "HIGH": 1, "MEDIUM": 0, "LOW": 0},
    }

    exec_text = generate_executive_summary(mock_alerts, summary_counts)
    assert "SMARTTRUST DAIRY PLANT ANALYTICS - EXECUTIVE SUMMARY" in exec_text
    assert "Total Alerts Flagged for Review: 2" in exec_text
    assert "Critical: 1" in exec_text
    assert "Pasteurizer Missing Sessions" in exec_text
