"""
Unit and integration tests for Module 2: Hygiene Analytics.
Includes strict checks for honest wording rules.
"""

from datetime import date, timedelta
import pandas as pd
import pytest

from ..hygiene_analytics import run_hygiene_analytics


def test_compliance_calculation_and_figures():
    """
    Tests compliance percentage calculation and reporting of both
    submitted and verified compliance figures.
    """
    schedule_df = pd.DataFrame([
        {
            "equipment_id": "PAST_01",
            "equipment_name": "Pasteurizer 01",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
        }
    ])

    # 10 days: 6 verified, 2 submitted, 1 incomplete, 1 missed
    start_date = date(2026, 10, 1)
    records = []
    statuses = ["verified"] * 6 + ["submitted"] * 2 + ["incomplete", "missed"]
    for i, st in enumerate(statuses):
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "shift": "Morning",
            "equipment_id": "PAST_01",
            "status": st,
            "submitted_by": "Operator",
            "verified_by": "Supervisor" if st == "verified" else "None",
        })

    records_df = pd.DataFrame(records)
    res = run_hygiene_analytics(cleaning_records=records_df, cleaning_schedule=schedule_df)

    eq_comp = res["equipment_compliance"]["PAST_01"]
    # Total expected = 10 sessions
    # Submitted compliance: (6 + 2) / 10 * 100 = 80.0%
    # Verified compliance: 6 / 10 * 100 = 60.0%
    assert eq_comp["expected_sessions"] == 10.0
    assert eq_comp["submitted_compliance_percent"] == 80.0
    assert eq_comp["verified_compliance_percent"] == 60.0
    assert eq_comp["missing_gap_sessions"] == 2


def test_repeated_missing_sessions_triggers_alert():
    """
    Flag when the same equipment has N or more incomplete/missed sessions
    within rolling window (defaults N=3, window=7 days).
    """
    schedule_df = pd.DataFrame([
        {
            "equipment_id": "PAST_01",
            "equipment_name": "Pasteurizer 01",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
        }
    ])

    start_date = date(2026, 10, 1)
    records = []
    # 7 days with 3 missed/incomplete sessions on days 2, 4, 6
    for i in range(7):
        st = "missed" if i in (2, 4, 6) else "verified"
        records.append({
            "date": str(start_date + timedelta(days=i)),
            "shift": "Morning",
            "equipment_id": "PAST_01",
            "status": st,
            "submitted_by": "Operator",
            "verified_by": "Supervisor" if st == "verified" else "None",
        })

    records_df = pd.DataFrame(records)
    res = run_hygiene_analytics(cleaning_records=records_df, cleaning_schedule=schedule_df)

    # Check that repeated missing sessions alert was generated
    repeated_alerts = [a for a in res["alerts"] if "Repeated Missing" in a["title"]]
    assert len(repeated_alerts) == 1
    rep_alert = repeated_alerts[0]
    assert rep_alert["severity"] == "HIGH"
    assert rep_alert["unit"] == "sessions"
    assert "Pasteurizer 01 cleaning records show repeated missing sessions" in rep_alert["recommendation"]
    assert "Supervisor review is recommended" in rep_alert["recommendation"]


def test_wording_rule_strictly_enforced():
    """
    Wording rule: All hygiene outputs MUST say 'records indicate' or 'recorded sessions'.
    NEVER state that equipment is or isn't physically clean.
    """
    schedule_df = pd.DataFrame([
        {
            "equipment_id": "TANK_01",
            "equipment_name": "Storage Tank 01",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
        }
    ])

    start_date = date(2026, 10, 1)
    records = [
        {
            "date": str(start_date + timedelta(days=i)),
            "shift": "Morning",
            "equipment_id": "TANK_01",
            "status": "missed" if i in (1, 2, 3) else "verified",
            "submitted_by": "Op",
            "verified_by": "None",
        }
        for i in range(7)
    ]

    res = run_hygiene_analytics(cleaning_records=pd.DataFrame(records), cleaning_schedule=schedule_df)

    for alert in res["alerts"]:
        exp = alert["explanation"].lower()
        rec = alert["recommendation"].lower()

        # Must mention records/recorded
        assert "record" in exp or "recorded" in exp
        assert "record" in rec or "recorded" in rec

        # Must NOT claim physical cleanliness
        assert "physically clean" not in exp
        assert "physically dirty" not in exp
        assert "is clean" not in exp
        assert "is dirty" not in exp
        assert "is contaminated" not in exp
