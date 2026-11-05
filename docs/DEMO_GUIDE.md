# SmartTrust Judge Demonstration & Walkthrough Guide
**Problem Statement ID:** DL-SJBIT-HK26-GOVP010 | **Hackathon:** LAKSHYA 2026  
**Application:** SmartTrust Dairy Plant Management System

---

## 1. Demo Credentials (Pre-Seeded)

| Role | Email | Password | Department / Access Scope |
| :--- | :--- | :--- | :--- |
| **Plant Employee** | `employee@smarttrust.demo` | `Demo@1234` | Pasteurisation (Can enter & edit pending records) |
| **Shift Supervisor** | `supervisor@smarttrust.demo` | `Demo@1234` | Pasteurisation (Reviews department pending queue) |
| **Plant Manager** | `manager@smarttrust.demo` | `Demo@1234` | Global (Full approvals, alerts, master data, users) |

---

## 2. Walkthrough Scenarios for Judges

### Scenario 1: Energy Anomaly Detection (HTST Pasteuriser 01)
1. **Login as Manager:** Sign in using `manager@smarttrust.demo`.
2. **Navigate to Alerts (`/alerts`):**
   - Locate Alert ID `ALT-ENG-20261105-01`: **"High Energy Consumption Detected: HTST Pasteuriser 01"**.
   - Severity: **HIGH**.
   - Explanation: Consumption of 345.20 kWh exceeds historical baseline mean of 294.99 kWh by $+17.0\%$ ($> \text{mean} + 3\sigma$).
3. **Inspect Evidence:** Show the judges the structured `evidence_json`:
   ```json
   {
     "reading_start_kwh": 12850.5,
     "reading_end_kwh": 13195.7,
     "consumption_kwh": 345.2,
     "baseline_mean_kwh": 294.99,
     "baseline_std_dev_kwh": 15.2,
     "deviation_from_mean_kwh": 50.21,
     "deviation_sigma_factor": 3.3,
     "sample_count": 30
   }
   ```
4. **Take Action:** Click **Review Alert**, select status **CONFIRMED**, enter review comment: *"Maintenance scheduled for steam heat exchanger bypass valve"*, and submit.

---

### Scenario 2: Hygiene Compliance Gap (Pasteuriser Line P1)
1. **Navigate to Hygiene Compliance Dashboard (`/dashboard/hygiene-compliance`):**
   - Point out area compliance for **Pasteuriser Line P1** ($97.8\%$ approved vs scheduled).
2. **Review Hygiene Alert (`/alerts`):**
   - Locate Alert ID `ALT-HYG-20261105-01`: **"Hygiene Specification Violation: Pasteuriser Line P1"**.
   - Explanation: Cleaning record on 2026-11-04 indicated chemical concentration of $0.5\%$, violating the mandated $1.0\% - 2.5\%$ standard.
   - Recommended Action: *"Supervisor audit of chemical doser calibration required"*.
3. **Emphasize Honesty Principle:** Highlight that the software explicitly states *"records indicate"* and evaluates documentation adherence without claiming physical swab sterility.

---

### Scenario 3: Material Wastage & Packaging Reconciliation
1. **Navigate to Waste Summary (`/dashboard/waste-summary`):**
   - Point out product **Table Butter**: Raw input 54,000 KG vs Actual output 52,134.36 KG.
   - Actual loss is $3.45\%$ against standard expected loss of $3.50\%$.
2. **Inspect Specific Batch Waste Alert:**
   - Locate Alert ID `ALT-WST-20261105-01`: **"Excessive Material Waste: Table Butter Batch BAT-BTR-20261105-01"**.
   - Severity: **HIGH**.
   - Loss recorded: $285\text{ KG}$ ($5.70\%$ loss), exceeding $1.5\times$ expected threshold.
   - Status: Marked **`FLAGGED_FOR_INVESTIGATION`** with candidate reasons (spillage during packing, separator bowl purge error, or meter calibration).

---

### Scenario 4: The 4-Stage Approval & Correction Lifecycle
1. **Step 1 (Employee Entry):**
   - Login as `employee@smarttrust.demo`.
   - Submit a new Energy Record: Reading Start = `14000.0`, Reading End = `14250.0`, Runtime = `8.0` hours.
   - Record enters `PENDING` status.
2. **Step 2 (Supervisor Review & Correction Request):**
   - Login as `supervisor@smarttrust.demo`.
   - Open Pending Queue (`/approvals/pending`).
   - Click **Request Correction**, entering comment: *"Please attach shift runtime logs to verify 8 hours"*.
   - Status transitions to `CORRECTION_REQUESTED`.
3. **Step 3 (Employee Resubmission):**
   - Login as `employee@smarttrust.demo`.
   - Edit the record, add note *"Attached shift sheet #402"*, and click **Resubmit**.
   - Status returns to `PENDING` with action `RESUBMITTED` in history.
4. **Step 4 (Supervisor Approval):**
   - Supervisor approves the record. Status becomes `APPROVED`.
   - Verify entry in `approval_history`.
