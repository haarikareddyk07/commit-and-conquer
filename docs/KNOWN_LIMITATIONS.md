# SmartTrust Known Limitations & Scope Boundaries
**Problem Statement ID:** DL-SJBIT-HK26-GOVP010 | **Hackathon:** LAKSHYA 2026  
**Audience:** Judges, Evaluation Panel, Plant Management

---

## 1. Scope Boundaries & Honest AI Disclaimers

### 1.1 No IoT, Hardware Sensors, or Real-Time Telemetry
- **Design Fact:** SmartTrust is intentionally architected for factory environments operating without expensive IoT sensors or automated SCADA feeds.
- **Data Source:** All operational metrics originate from manual operator entries, physical logbooks, and uploaded factory spreadsheets (CSV/Excel).
- **Limitation:** The system cannot detect machine state changes between recorded shifts.

---

### 1.2 No Physical Verification of Cleanliness or Sanitation
- **Strict Wording Rule:** All hygiene analytics outputs state *"records indicate"* or *"recorded sessions"*.
- **Limitation:** Software cannot physically verify whether equipment was sanitized, whether chemical contact time was maintained in reality, or whether biological swabs passed lab inspection.
- **Purpose:** The system flags **documentation gaps**, missed schedule deadlines, and out-of-spec chemical logs for supervisory audit.

---

### 1.3 Material Excess is Flagged for Investigation (Not Confirmed Waste)
- **Honesty Rule:** High variance between raw milk input and packaged goods output is flagged with status `FLAGGED_FOR_INVESTIGATION`.
- **Limitation:** The engine does not presume to diagnose the exact physical loss without on-site investigation. Candidate causes (in-process spillage, reject packaging, over-issuance, or meter error) are provided to guide human investigation.

---

### 1.4 Explainable Rule-Based Analytics (No Unsubstantiated "AI Predictions")
- **Methodology:** Anomaly alerts are derived from deterministic statistical formulas (mean, rolling median, standard deviation bands, and MAD robust z-scores).
- **Limitation:** The engine does not claim to "predict" future equipment breakdowns or forecast dairy market demand. Every alert links directly to mathematical evidence (`evidence_json`).

---

### 1.5 Database & Scale Scope
- **Storage Engine:** SQLite 3 via `better-sqlite3` in WAL mode.
- **Scale:** Optimized for single-plant dairy factory operations (up to 500,000 records/year with sub-millisecond query performance). Not intended as a multi-tenant global ERP system.
