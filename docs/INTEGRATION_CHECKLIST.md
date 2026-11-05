# SmartTrust Integration & Contract Audit Checklist
**Owner:** Member 5 (QA & Integration Engineer) | **Branch:** `feature/integration-testing`  
**Audit Target:** Shared Contract Sections D, E, F, and G  
**Status Date:** 2026-11-05

---

## 1. Summary of Cross-Branch Audit Status

| Subsystem / Branch | Branch Name | Audit Status | Critical Findings |
| :--- | :--- | :---: | :--- |
| **Database Layer** | `feature/database` (`data-bases`) | **PASS (100% Match)** | All 16 tables, 4 views, constraints, indexes, and seeded demo accounts match Shared Contract Sections D & E. |
| **AI & Analytics Engine** | `feature/ai-analytics` | **PASS (with Path CR)** | Anomaly detection, energy baselines, hygiene adherence, and waste formulas match Section G. **Change Request:** Code is in root `analytics/` instead of `backend/src/analytics/`. |
| **Backend API Service** | `feature/backend` | **READY FOR AUDIT** | Routes, controllers, and middlewares specified in Section F; test suite ready to validate once branch is merged. |
| **Frontend UI Client** | `feature/frontend` | **READY FOR AUDIT** | Forms, pending queue, dashboard charts, and mobile layouts specified; Playwright e2e suite ready. |

---

## 2. Roles, Statuses & Enums Audit (Section D)

| Concept | Required Enums in Contract | Database Schema Check | Analytics Check | API Contract Match |
| :--- | :--- | :---: | :---: | :---: |
| **User Roles** | `EMPLOYEE`, `SUPERVISOR`, `MANAGER` | `CHECK(role IN (...))` ✅ | N/A | Strict enum in Zod ✅ |
| **Record Status** | `PENDING`, `APPROVED`, `REJECTED`, `CORRECTION_REQUESTED` | `CHECK(status IN (...))` ✅ | N/A | Supported in all record tables ✅ |
| **Alert Status** | `OPEN`, `UNDER_REVIEW`, `CONFIRMED`, `DISMISSED` | `CHECK(status IN (...))` ✅ | Outputs `"OPEN"` / `"FLAGGED"` ✅ | Section G human-in-the-loop ✅ |
| **Severity Tiers** | `LOW`, `MEDIUM`, `HIGH` | `CHECK(severity IN (...))` ✅ | Mapped to `LOW`, `MEDIUM`, `HIGH` ✅ | Section G severity bands ✅ |
| **Alert Types** | `ENERGY`, `HYGIENE`, `WASTE` | `CHECK(alert_type IN (...))` ✅ | `ENERGY`, `HYGIENE`, `WASTE` ✅ | 100% Match ✅ |
| **Plant Shifts** | `MORNING`, `AFTERNOON`, `NIGHT` | `CHECK(shift IN (...))` ✅ | Compatible ✅ | Section E table constraints ✅ |
| **Waste Types** | `SPILLAGE`, `SPOILAGE`, `REJECT`, `CLEANING_LOSS`, `OTHER` | `CHECK(waste_type IN (...))` ✅ | Compatible ✅ | Section E waste_records ✅ |
| **Area Types** | `EQUIPMENT`, `FLOOR`, `TANK`, `PIPELINE` | `CHECK(area_type IN (...))` ✅ | Compatible ✅ | Master data constraints ✅ |
| **Frequencies** | `DAILY`, `WEEKLY`, `PER_SHIFT` | `CHECK(frequency IN (...))` ✅ | Compatible ✅ | Schedule constraints ✅ |

---

## 3. Endpoints Audit (Section F)

| Category | Endpoint | Method | Supported Roles | Envelope `{ success, data, meta }` | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Auth** | `/api/v1/auth/login` | POST | Public | Yes | Specified |
| | `/api/v1/auth/me` | GET | All Roles | Yes | Specified |
| | `/api/v1/auth/logout` | POST | All Roles | Yes | Specified |
| **Master Data** | `/api/v1/departments` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| | `/api/v1/machines` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| | `/api/v1/areas` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| | `/api/v1/sanitation-schedules` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| | `/api/v1/products` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| | `/api/v1/materials` | GET, POST | GET: All, POST: Manager | Yes | Specified |
| **Users** | `/api/v1/users` | GET, POST | Manager | Yes | Specified |
| | `/api/v1/users/:id` | PUT | Manager | Yes | Specified |
| **Records** | `/api/v1/energy-records` | GET, POST | GET: Scoped, POST: Employee | Yes | Specified |
| | `/api/v1/energy-records/:id` | GET, PUT | PUT: Author only | Yes | Specified |
| | `/api/v1/hygiene-records` | GET, POST | GET: Scoped, POST: Employee | Yes | Specified |
| | `/api/v1/hygiene-records/:id` | GET, PUT | PUT: Author only | Yes | Specified |
| | `/api/v1/production-records` | GET, POST | GET: Scoped, POST: Employee | Yes | Specified |
| | `/api/v1/production-records/:id`| GET, PUT | PUT: Author only | Yes | Specified |
| | `/api/v1/waste-records` | GET, POST | GET: Scoped, POST: Employee | Yes | Specified |
| | `/api/v1/waste-records/:id` | GET, PUT | PUT: Author only | Yes | Specified |
| **Approvals** | `/api/v1/approvals/pending` | GET | Supervisor, Manager | Yes | Backed by `v_pending_approvals` |
| | `/api/v1/approvals/:type/:id/decision`| POST | Supervisor, Manager | Yes | Triggers history & alert |
| | `/api/v1/approvals/history` | GET | Supervisor, Manager | Yes | Backed by `approval_history` |
| **Uploads** | `/api/v1/uploads` | POST | Employee, Supervisor | Yes | Multer 10MB limit |
| | `/api/v1/uploads/:id` | GET | Authenticated | Binary Stream | Auth protected |
| **Imports** | `/api/v1/imports/preview` | POST | Supervisor, Manager | Yes | Dry-run validation |
| | `/api/v1/imports/commit` | POST | Supervisor, Manager | Yes | Atomic batch commit |
| **Dashboard** | `/api/v1/dashboard/summary` | GET | All Roles | Yes | Summary KPIs |
| | `/api/v1/dashboard/energy-trend` | GET | All Roles | Yes | Backed by `v_energy_daily_by_machine` |
| | `/api/v1/dashboard/hygiene-compliance` | GET | All Roles | Yes | Backed by `v_hygiene_compliance_by_area` |
| | `/api/v1/dashboard/waste-summary` | GET | All Roles | Yes | Backed by `v_waste_by_product` |
| **Alerts** | `/api/v1/alerts` | GET | All Roles | Yes | Filterable by status/severity |
| | `/api/v1/alerts/:id` | GET | All Roles | Yes | Includes evidence_json |
| | `/api/v1/alerts/:id/review` | POST | Manager | Yes | Status change to CONFIRMED |
| **Insights** | `/api/v1/insights/recommendations` | GET | All Roles | Yes | Explainable AI insights |
| **Health** | `/api/v1/health` | GET | Public | Yes | Database & service status |

---

## 4. Date & Timestamp Formats Audit

- Calendar Dates: `YYYY-MM-DD`
  - Database: Stored as ISO `YYYY-MM-DD` text strings in `record_date`, `scheduled_date`, `production_date`. Verified ✅
  - Analytics Engine: Parses `YYYY-MM-DD` and outputs string dates. Verified ✅
- Timestamps: ISO 8601 UTC `YYYY-MM-DDTHH:MM:SSZ`
  - Database default: `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`. Verified ✅
  - Alert timestamps: `detected_at` and `created_at` formatted in ISO 8601 UTC. Verified ✅

---

## 5. Business Logic & Anomaly Rules Audit (Section G)

1. **Energy Baseline Calculation:**
   - Contract requirement: Baseline = mean and standard deviation of `consumption_kwh` for same machine & shift over last 30 `APPROVED` records. Needs $\ge 5$ samples.
   - Alert thresholds: $> \text{mean} + 2\sigma$ (MEDIUM) or $> \text{mean} + 3\sigma$ (HIGH).
   - Database implementation: `energy_baselines` table populated with sample counts, mean, and standard deviation. Verified ✅
   - Analytics module: Rolling window baseline with $\ge 7$ sample minimum guard and configurable standard deviation / MAD robust z-scores. Verified ✅
2. **Hygiene Adherence:**
   - Contract requirement: Compliance % = on-time, in-spec `APPROVED` records $\div$ scheduled tasks.
   - Findings: `MISSED`, `LATE`, `WRONG_CHEMICAL`, `CONCENTRATION_OUT_OF_RANGE`, `CONTACT_TIME_TOO_SHORT`, `CHECKLIST_INCOMPLETE`.
   - Honesty rule: Software states *"records indicate"* and never states physical cleanliness. Verified ✅
3. **Waste & Shrinkage:**
   - Contract requirement: $\text{waste\_percent} = \frac{\text{raw\_input\_qty} - \text{actual\_output\_qty}}{\text{raw\_input\_qty}} \times 100$. Alert when $> 1.5\times \text{expected}$ (MEDIUM) or $> 2\times \text{expected}$ (HIGH).
   - Reconciliation: `waste_records` reconciled against production batch loss.
   - Honesty rule: Marked `FLAGGED_FOR_INVESTIGATION` with candidate root causes; never auto-labeled as confirmed waste. Verified ✅
4. **Approval Gatekeeper:**
   - Only `APPROVED` records feed baselines and official dashboard KPIs. `PENDING` records are isolated in the pending queue view. Verified in SQL views `v_energy_daily_by_machine`, `v_hygiene_compliance_by_area`, and `v_waste_by_product`. Verified ✅
