# SMARTTRUST: AI & Data Analytics Engine
**Problem Statement ID:** DL-SJBIT-HK26-GOVP010 | **Hackathon:** LAKSHYA 2026  
**Git Branch:** `feature/ai-analytics` | **Directory:** `analytics/`  
**Notice on Sample Data:** All test and sample datasets are explicitly marked `"data_source": "SIMULATED"`. Real plant data is designated `"data_source": "REAL"`.

---

## 1. Executive Overview

SMARTTRUST is an AI & Data Analytics engine for dairy processing plants designed to uncover operational inefficiencies in energy consumption, sanitation adherence, and material waste strictly from **historical and recorded operational data**.

### Core Design Principles
1. **Explainable First:** Every alert is accompanied by an exact mathematical explanation citing detected values, historical baselines, and threshold cut-offs.
2. **Configurable:** Zero hardcoded magic numbers. All thresholds, window sizes, and severity tiers are configured via `config.yaml` / `config.py`.
3. **Deterministic:** Seeded (seed=42) and reproducible. No pseudo-random analysis.
4. **Honest:** No unsubstantiated claims of predictive maintenance or physical verification. Findings reflect documentation logs only and flag items as `FLAGGED_FOR_INVESTIGATION`.
5. **Robust:** Full validation against negative values, impossible data, duplicates, and missing columns with graceful degradation.
6. **Transparent:** Explicit differentiation between `"SIMULATED"` and `"REAL"` data sources.

---

## 2. Directory Structure

```text
smarttrust/
└── analytics/
    ├── __init__.py               # Package exports
    ├── config.py                 # Dataclass configuration loader
    ├── config.yaml               # Human-readable threshold configuration
    ├── exceptions.py             # Custom exceptions with row/field metadata
    ├── validation.py             # Data loading, schema validation, and cleaning
    ├── anomaly_detection.py      # Statistical baselines, robust z-scores, ML secondary checks
    ├── energy_analytics.py       # Module 1: Historical baseline, trends, peer comparison
    ├── hygiene_analytics.py      # Module 2: Sanitation schedule adherence and missing logs
    ├── waste_analytics.py        # Module 3: Milk loss and packaging reconciliation
    ├── recommendations.py        # Module 4: Template-based AI insights & executive summary
    ├── formatter.py              # Module 5: Standardized alert schema and response builder
    ├── engine.py                 # Primary entry point (run_analytics)
    ├── api.py                    # Optional FastAPI REST service
    ├── sample_data/              # Seeded deterministic dataset generator
    │   ├── generator.py          # Generator script (Seed 42)
    │   ├── energy_records.csv
    │   ├── cleaning_schedule.csv
    │   ├── cleaning_records.csv
    │   ├── production_records.csv
    │   ├── milk_loss_records.csv
    │   └── packaging_records.csv
    ├── tests/                    # Pytest suite (100% passing)
    │   ├── test_validation.py    # Schema errors, negative values, empty inputs
    │   ├── test_energy.py        # 100->150 kWh worked example, baseline tests
    │   ├── test_hygiene.py       # Submitted vs verified compliance, wording rules
    │   ├── test_waste.py         # Milk loss %, FLAGGED_FOR_INVESTIGATION assertion
    │   ├── test_recommendations.py# Plain-language templates, executive summary
    │   └── test_api_and_engine.py# End-to-end orchestration & FastAPI models
    └── README.md                 # Complete documentation
```

---

## 3. Mathematical Formulas & Calculations

### Module 1: Energy Analytics
- **Historical Baseline ($B$):**
  $$\text{Baseline} = \text{Median}(X_{t-\text{window}} \dots X_{t-1})$$
  *(Fallback to Mean configurable. Requires minimum 7 historical records; otherwise marked `"INSUFFICIENT_BASELINE"`).*
- **Percentage Increase ($\Delta\%$):**
  $$\Delta\% = \left(\frac{x_{\text{actual}} - B}{\max(B, \epsilon)}\right) \times 100$$
- **Robust Z-Score ($Z_{\text{robust}}$):**
  $$\text{MAD} = \text{Median}(|X - \text{Median}(X)|)$$
  $$Z_{\text{robust}} = 0.6745 \times \frac{x_{\text{actual}} - \text{Median}(X)}{\max(\text{MAD}, \epsilon)}$$
- **Normalized Runtime Consumption:**
  $$\text{kWh/Hour} = \frac{\text{energy\_kwh}}{\text{runtime\_hours}}$$
- **Normalized Production Consumption:**
  $$\text{kWh/Unit} = \frac{\text{energy\_kwh}}{\text{production\_units}}$$

### Module 2: Hygiene Analytics
- **Required Sessions ($S_{\text{expected}}$):** Scaled across observation period based on frequency (daily: $F \times D$, shift: $F \times D \times 3$, weekly: $F \times \frac{D}{7}$).
- **Submitted Compliance %:**
  $$\text{Compliance}_{\text{submitted}} = \left(\frac{N_{\text{submitted}} + N_{\text{verified}}}{S_{\text{expected}}}\right) \times 100$$
- **Verified Compliance %:**
  $$\text{Compliance}_{\text{verified}} = \left(\frac{N_{\text{verified}}}{S_{\text{expected}}}\right) \times 100$$
- **Repeated Missing Sessions:** Flagged when $\ge 3$ records in a rolling 7-day window are `incomplete` or `missed`.

### Module 3: Waste Analytics
- **Milk Wastage %:**
  $$\text{Wastage}\% = \left(\frac{\text{loss\_litres}}{\max(\text{milk\_input\_litres}, \epsilon)}\right) \times 100$$
- **Expected Packaging Material:**
  $$\text{Expected Qty} = \text{finished\_output\_units} \times \text{units\_per\_package\_ratio}$$
- **Packaging Variance %:**
  $$\text{Variance}\% = \left(\frac{\text{used\_qty} - \text{expected\_qty}}{\max(\text{expected\_qty}, \epsilon)}\right) \times 100$$
- **Damaged Packaging %:**
  $$\text{Damaged}\% = \left(\frac{\text{damaged\_qty}}{\max(\text{used\_qty}, \epsilon)}\right) \times 100$$

---

## 4. Configuration & Thresholds (`config.yaml`)

| Parameter | Default | Severity Tier / Behavior |
| :--- | :--- | :--- |
| `energy.baseline_window_days` | `30` | Rolling observation window in days |
| `energy.min_history_records` | `7` | Under 7 records yields `"INSUFFICIENT_BASELINE"` |
| `energy.threshold_low_pct` | `15.0%` | Triggers **LOW** severity alert |
| `energy.threshold_med_pct` | `30.0%` | Triggers **MEDIUM** severity alert |
| `energy.threshold_high_pct` | `50.0%` | Triggers **HIGH** severity alert |
| `energy.robust_zscore_threshold` | `2.5` | Secondary statistical threshold |
| `energy.enable_isolation_forest` | `false` | Optional secondary ML check |
| `hygiene.compliance_band_critical` | `60.0%` | Compliance $< 60\%$ triggers **CRITICAL** |
| `hygiene.compliance_band_high` | `75.0%` | Compliance $< 75\%$ triggers **HIGH** |
| `hygiene.compliance_band_medium` | `90.0%` | Compliance $< 90\%$ triggers **MEDIUM** |
| `hygiene.compliance_band_low` | `98.0%` | Compliance $< 98\%$ triggers **LOW** |
| `hygiene.repeated_missed_threshold_count` | `3` | Triggers **HIGH** sanitation record alert |
| `hygiene.repeated_missed_window_days` | `7` | Rolling window for non-compliance count |
| `waste.milk_loss_pct_low / med / high / crit` | `1.5% / 3.0% / 5.0% / 10.0%` | Milk processing shrinkage tiers |
| `waste.excess_pkg_pct_low / med / high / crit` | `5.0% / 10.0% / 20.0% / 35.0%` | Packaging material variance tiers |

---

## 5. Justification for Machine Learning Usage

| Module | ML Used? | Technique | Rationale & Justification |
| :--- | :--- | :--- | :--- |
| **Module 1: Energy** | **Secondary Optional** | `scikit-learn` `IsolationForest` | **Primary:** Rolling median + MAD robust Z-score provides full explainability for plant engineers. **Secondary ML:** Enabled via `enable_isolation_forest: true` in config as an un-supervised confirmation check when history $\ge 10$ samples. It does not replace the primary formula. |
| **Module 2: Hygiene** | **No** | Deterministic Schedule Comparison | Sanitation adherence is a strict regulatory compliance SOP. A missing or unverified cleaning session is a factual documentation gap, not a probabilistic anomaly. Using ML would obscure compliance reporting. |
| **Module 3: Waste** | **No** | Mass-Balance & Material Reconciliation | Factory material audits require exact physical mass-balance reconciliation ($\text{milk in} - \text{loss} = \text{milk out}$). Excess packaging must be flagged for human investigation (`FLAGGED_FOR_INVESTIGATION`) with candidate physical reasons rather than black-box categorization. |
| **Module 4: Insights** | **No** | Template & Rule-Based Engine | In production plants, recommendations must be transparent, verifiable, and free of generative hallucinations or runtime latency. |

---

## 6. Input & Output Schemas

### Input Schemas
1. **`energy_records`**:
   - Required: `date` (YYYY-MM-DD), `machine_id` (str), `machine_name` (str), `energy_kwh` (float $\ge 0$).
   - Optional: `runtime_hours` (0 to 24), `production_units` ($\ge 0$), `machine_type` (str).
2. **`cleaning_schedule`**:
   - Required: `equipment_id` (str), `equipment_name` (str), `required_frequency` ("daily" | "per-shift" | "weekly"), `required_times_per_period` (float $> 0$).
3. **`cleaning_records`**:
   - Required: `date` (YYYY-MM-DD), `shift` (str), `equipment_id` (str), `status` ("submitted" | "verified" | "incomplete" | "missed"), `submitted_by` (str), `verified_by` (str).
   - Optional: `completion_percent` (0 to 100).
4. **`production_records`**:
   - Required: `date` (YYYY-MM-DD), `batch_id` (str), `product_type` (str), `milk_input_litres` (float $\ge 0$), plus at least one of `finished_output_litres` or `finished_output_units`.
5. **`milk_loss_records`**:
   - Required: `date` (YYYY-MM-DD), `batch_id` (str), `loss_litres` (float $\ge 0$).
   - Optional: `reason` (str).
6. **`packaging_records`**:
   - Required: `date` (YYYY-MM-DD), `material_type` (str), `issued_qty` ($\ge 0$), `used_qty` ($\ge 0$), `damaged_qty` ($\ge 0$), `rejected_qty` ($\ge 0$).
   - Optional: `units_per_package_ratio` (float $> 0$).

### Standard Alert JSON Output Schema (Module 5)
```json
{
  "alert_id": "ENERGY-CHILLER01-20261014-01",
  "title": "Excessive Energy Consumption: Chiller 01",
  "category": "ENERGY",
  "severity": "HIGH",
  "affected_equipment": "Chiller 01",
  "detected_value": 150.0,
  "expected_value": 100.0,
  "unit": "kWh",
  "deviation_percent": 50.0,
  "explanation": "Actual consumption (150.0 kWh) is +50.0% above the 30-day rolling median baseline (100.0 kWh). Robust Z-Score: 4.82 (MAD: 0.50, Median: 100.0 kWh). Exceeds high severity threshold (+50%). Normalized runtime efficiency: 8.33 kWh/hour.",
  "recommendation": "Chiller 01 consumption is significantly higher than its historical baseline (150.0 vs baseline 100.0 kWh, +50.0%). Inspect the equipment.",
  "period": {
    "start": "2026-10-14",
    "end": "2026-10-14"
  },
  "data_source": "SIMULATED",
  "confidence_note": "Baseline established from 13 historical records via rolling median."
}
```

### Top-Level Analytics Response
```json
{
  "status": "SUCCESS",
  "generation_timestamp": "2026-11-05T08:45:00.000000+00:00",
  "data_source": "SIMULATED",
  "summary": {
    "total_alerts": 4,
    "by_category": { "ENERGY": 1, "HYGIENE": 2, "WASTE": 1 },
    "by_severity": { "LOW": 0, "MEDIUM": 0, "HIGH": 4, "CRITICAL": 0 }
  },
  "executive_summary": "SMARTTRUST DAIRY PLANT ANALYTICS - EXECUTIVE SUMMARY\n...",
  "alerts": [...],
  "warnings": [...]
}
```

---

## 7. How to Run

### Installation
```bash
# Python 3.10+ required
pip install pandas numpy scikit-learn fastapi uvicorn pydantic pyyaml pytest httpx
```

### 1. Primary Python Interface
```python
import pandas as pd
from analytics import run_analytics

inputs = {
    "energy_records": pd.read_csv("analytics/sample_data/energy_records.csv"),
    "cleaning_schedule": pd.read_csv("analytics/sample_data/cleaning_schedule.csv"),
    "cleaning_records": pd.read_csv("analytics/sample_data/cleaning_records.csv"),
    "production_records": pd.read_csv("analytics/sample_data/production_records.csv"),
    "milk_loss_records": pd.read_csv("analytics/sample_data/milk_loss_records.csv"),
    "packaging_records": pd.read_csv("analytics/sample_data/packaging_records.csv"),
    "data_source": "SIMULATED",
}

# Run analytics with default configuration
results = run_analytics(inputs)
print(results["executive_summary"])
```

### 2. Running Individual Modules
```python
from analytics import run_energy_analytics, run_hygiene_analytics, run_waste_analytics

# Module 1
energy_res = run_energy_analytics(inputs["energy_records"])

# Module 2
hygiene_res = run_hygiene_analytics(inputs["cleaning_records"], inputs["cleaning_schedule"])

# Module 3
waste_res = run_waste_analytics(inputs["production_records"], packaging_records=inputs["packaging_records"])
```

### 3. Running Sample Data Generator
```bash
python -m analytics.sample_data.generator
```

### 4. Running the Test Suite
```bash
pytest -p no:anyio analytics/tests/ -v
```

### 5. Running Optional FastAPI Server
```bash
uvicorn analytics.api:app --host 0.0.0.0 --port 8000 --reload
```
Endpoints available:
- `GET /health`
- `POST /analyze/energy`
- `POST /analyze/hygiene`
- `POST /analyze/waste`
- `POST /analyze/all`

---

## 8. Questions & Assumptions to Confirm with Backend Team

1. **Shift Structure & Frequency Mapping:**
   - *Current Assumption:* If `required_frequency` is `"per-shift"`, the plant operates on 3 shifts per 24-hour day ($3 \times \text{days}$). Confirm if some equipment is only scheduled for 1 or 2 shifts.
2. **Finished Output Units:**
   - *Current Assumption:* Reconciling packaging requires `finished_output_units`. If only `finished_output_litres` is provided, the engine estimates 1 unit/litre and issues an explicit warning. Confirm whether a unit packaging factor is maintained in the product catalog.
3. **Batch ID Linkage:**
   - *Current Assumption:* `production_records` and `milk_loss_records` share an identical `batch_id`. If unlinked, milk wastage is aggregated at the plant level by date.
4. **Data Ingestion Format:**
   - *Current Support:* The engine seamlessly accepts pandas DataFrames, raw CSV strings, CSV file paths, or lists of JSON dictionaries.

---

## 9. Honesty & Scope Disclaimer

- **No Physical Verification:** All hygiene evaluations evaluate **recorded cleaning documentation adherence**. Findings explicitly state *"records indicate"* or *"recorded sessions"*. The analytics engine never states or implies that equipment is physically sanitized or contaminated.
- **Investigation Only:** High material usage variances are marked with status `"FLAGGED_FOR_INVESTIGATION"` and list potential operational causes (process damage, QC rejection, over-issuance, or reporting errors). They are **never** auto-labeled as confirmed waste.
- **Historical Analysis Only:** The engine analyzes existing recorded records and does not perform real-time IoT streaming or predictive sensor modeling.
