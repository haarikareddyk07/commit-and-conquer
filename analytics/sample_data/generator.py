"""
Deterministic Seeded Sample Data Generator for SMARTTRUST Analytics Engine.
Plants explicit test scenarios:
  (a) Energy: CHILLER_01 jumps from ~100 kWh baseline to 150 kWh (+50% anomaly).
  (b) Hygiene: PASTEURIZER_01 records repeated missing cleaning sessions (>= 3 missed in rolling 7 days).
  (c) Waste: Packaging material (HDPE_Pouch) used exceeds expected production quantity by > 20%.

All generated records include "data_source": "SIMULATED".
"""

from datetime import date, timedelta
from pathlib import Path
import random
import numpy as np
import pandas as pd

RANDOM_SEED = 42


def generate_sample_datasets(output_dir: Path) -> None:
    """Generates all 6 sample CSVs deterministically using seed 42."""
    np.random.seed(RANDOM_SEED)
    random.seed(RANDOM_SEED)
    output_dir.mkdir(parents=True, exist_ok=True)

    start_date = date(2026, 10, 1)
    num_days = 14
    dates = [start_date + timedelta(days=i) for i in range(num_days)]

    # 1. Energy Records
    # CHILLER_01: 13 days of ~100 kWh (100.0), then on day 14 jumps to 150.0 kWh (+50%)
    # CHILLER_02: Peer machine stable ~102 kWh
    # BOILER_01: Stable ~250 kWh
    # PASTEURIZER_01: Stable ~80 kWh
    energy_rows = []
    for d_idx, d in enumerate(dates):
        d_str = str(d)
        is_last_day = (d_idx == num_days - 1)

        # Chiller 1 (Planted scenario: 100 -> 150 on last day)
        c1_kwh = 150.0 if is_last_day else round(100.0 + (d_idx % 3) * 0.5, 1)
        energy_rows.append({
            "date": d_str,
            "machine_id": "CHILLER_01",
            "machine_name": "Chiller 01",
            "energy_kwh": c1_kwh,
            "runtime_hours": 18.0 if is_last_day else 16.0,
            "production_units": 9800 if is_last_day else 9500,
            "data_source": "SIMULATED",
        })

        # Chiller 2 (Peer machine)
        c2_kwh = round(102.0 + (d_idx % 2) * 1.0, 1)
        energy_rows.append({
            "date": d_str,
            "machine_id": "CHILLER_02",
            "machine_name": "Chiller 02",
            "energy_kwh": c2_kwh,
            "runtime_hours": 16.0,
            "production_units": 9500,
            "data_source": "SIMULATED",
        })

        # Boiler 1
        b1_kwh = round(250.0 + (d_idx % 4) * 2.0, 1)
        energy_rows.append({
            "date": d_str,
            "machine_id": "BOILER_01",
            "machine_name": "Boiler 01",
            "energy_kwh": b1_kwh,
            "runtime_hours": 20.0,
            "production_units": 15000,
            "data_source": "SIMULATED",
        })

        # Pasteurizer 1
        p1_kwh = round(80.0 + (d_idx % 3) * 0.8, 1)
        energy_rows.append({
            "date": d_str,
            "machine_id": "PAST_01",
            "machine_name": "Pasteurizer 01",
            "energy_kwh": p1_kwh,
            "runtime_hours": 12.0,
            "production_units": 10000,
            "data_source": "SIMULATED",
        })

    pd.DataFrame(energy_rows).to_csv(output_dir / "energy_records.csv", index=False)

    # 2. Cleaning Schedule
    schedule_rows = [
        {
            "equipment_id": "PAST_01",
            "equipment_name": "Pasteurizer 01",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
            "data_source": "SIMULATED",
        },
        {
            "equipment_id": "TANK_01",
            "equipment_name": "Raw Milk Silo 01",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
            "data_source": "SIMULATED",
        },
        {
            "equipment_id": "PKG_LINE_01",
            "equipment_name": "Pouch Packaging Machine",
            "required_frequency": "daily",
            "required_times_per_period": 1.0,
            "data_source": "SIMULATED",
        },
    ]
    pd.DataFrame(schedule_rows).to_csv(output_dir / "cleaning_schedule.csv", index=False)

    # 3. Cleaning Records
    # Planted scenario: PAST_01 has repeated missing/incomplete sessions in the last 5 days
    cleaning_rows = []
    for d_idx, d in enumerate(dates):
        d_str = str(d)

        # PAST_01
        if d_idx in [9, 11, 13]:  # 3 missing/incomplete in rolling 7-day window
            past_status = "missed" if d_idx != 11 else "incomplete"
            clean_pct = 0.0 if past_status == "missed" else 45.0
        else:
            past_status = "verified"
            clean_pct = 100.0

        cleaning_rows.append({
            "date": d_str,
            "shift": "Night",
            "equipment_id": "PAST_01",
            "status": past_status,
            "submitted_by": "Operator_Ramesh",
            "verified_by": "Sup_Anil" if past_status == "verified" else "None",
            "completion_percent": clean_pct,
            "data_source": "SIMULATED",
        })

        # TANK_01: perfectly compliant
        cleaning_rows.append({
            "date": d_str,
            "shift": "Morning",
            "equipment_id": "TANK_01",
            "status": "verified",
            "submitted_by": "Operator_Suresh",
            "verified_by": "Sup_Anil",
            "completion_percent": 100.0,
            "data_source": "SIMULATED",
        })

        # PKG_LINE_01: normal submitted
        cleaning_rows.append({
            "date": d_str,
            "shift": "Evening",
            "equipment_id": "PKG_LINE_01",
            "status": "submitted",
            "submitted_by": "Operator_Vijay",
            "verified_by": "None",
            "completion_percent": 100.0,
            "data_source": "SIMULATED",
        })

    pd.DataFrame(cleaning_rows).to_csv(output_dir / "cleaning_records.csv", index=False)

    # 4. Production Records
    prod_rows = []
    for d_idx, d in enumerate(dates):
        d_str = str(d)
        batch_id_1 = f"B202610{d_idx+1:02d}-01"
        batch_id_2 = f"B202610{d_idx+1:02d}-02"

        prod_rows.append({
            "date": d_str,
            "batch_id": batch_id_1,
            "product_type": "Toned Milk 500ml",
            "milk_input_litres": 5000.0,
            "finished_output_litres": 4920.0,
            "finished_output_units": 9840,
            "data_source": "SIMULATED",
        })
        prod_rows.append({
            "date": d_str,
            "batch_id": batch_id_2,
            "product_type": "Standardized Milk 1L",
            "milk_input_litres": 6000.0,
            "finished_output_litres": 5910.0,
            "finished_output_units": 5910,
            "data_source": "SIMULATED",
        })

    pd.DataFrame(prod_rows).to_csv(output_dir / "production_records.csv", index=False)

    # 5. Milk Loss Records
    loss_rows = []
    for d_idx, d in enumerate(dates):
        d_str = str(d)
        batch_id_1 = f"B202610{d_idx+1:02d}-01"
        batch_id_2 = f"B202610{d_idx+1:02d}-02"

        # On day 12, batch 1 has elevated milk loss (320 L on 5000 L -> 6.4% loss)
        loss_1 = 320.0 if d_idx == 12 else 80.0
        reason_1 = "Separator seal wear inspection" if d_idx == 12 else "Normal operational transfer shrinkage"

        loss_rows.append({
            "date": d_str,
            "batch_id": batch_id_1,
            "loss_litres": loss_1,
            "reason": reason_1,
            "data_source": "SIMULATED",
        })
        loss_rows.append({
            "date": d_str,
            "batch_id": batch_id_2,
            "loss_litres": 90.0,
            "reason": "Normal operational transfer shrinkage",
            "data_source": "SIMULATED",
        })

    pd.DataFrame(loss_rows).to_csv(output_dir / "milk_loss_records.csv", index=False)

    # 6. Packaging Records
    # Planted scenario: HDPE_Pouch used quantity exceeds production-based expectation
    # On day 14 (or aggregated across days): Total finished output units = 9840 + 5910 = 15750 units.
    # Expected HDPE pouches for 9840 units at 1.0 ratio is 9840.
    # Issued: 13,000, Used: 12,200 (+24% excess), Damaged: 850, Rejected: 420.
    pkg_rows = []
    for d_idx, d in enumerate(dates):
        d_str = str(d)
        is_last_day = (d_idx == num_days - 1)

        # HDPE Pouch: on last day has large excess usage
        pouch_used = 12200 if is_last_day else 9900
        pouch_damaged = 850 if is_last_day else 80
        pouch_rejected = 420 if is_last_day else 30
        pouch_issued = 13000 if is_last_day else 10100

        pkg_rows.append({
            "date": d_str,
            "material_type": "HDPE_Pouch",
            "issued_qty": pouch_issued,
            "used_qty": pouch_used,
            "damaged_qty": pouch_damaged,
            "rejected_qty": pouch_rejected,
            "units_per_package_ratio": 1.0,
            "data_source": "SIMULATED",
        })

        # Carton_1L: normal usage
        pkg_rows.append({
            "date": d_str,
            "material_type": "Carton_1L",
            "issued_qty": 6000,
            "used_qty": 5930,
            "damaged_qty": 40,
            "rejected_qty": 10,
            "units_per_package_ratio": 1.0,
            "data_source": "SIMULATED",
        })

    pd.DataFrame(pkg_rows).to_csv(output_dir / "packaging_records.csv", index=False)


if __name__ == "__main__":
    out_path = Path(__file__).parent
    generate_sample_datasets(out_path)
    print(f"Sample simulated datasets generated successfully in: {out_path.resolve()}")
