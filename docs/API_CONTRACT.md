# SmartTrust API Contract (Source of Truth)
**Version:** 1.0.0 | **Problem Statement ID:** DL-SJBIT-HK26-GOVP010  
**Base URL:** `/api/v1` | **Default Port:** `5000`

---

## 1. Global Conventions & Standards

### Envelopes
Every API response must strictly return JSON wrapped in the standard envelope:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted reading end value cannot be lower than reading start value.",
    "details": [
      {
        "field": "reading_end_kwh",
        "message": "reading_end_kwh must be greater than or equal to reading_start_kwh"
      }
    ]
  }
}
```

### Standard Error Codes
- `VALIDATION_ERROR` (HTTP 400): Schema or semantic business rule failure.
- `UNAUTHENTICATED` (HTTP 401): Missing, expired, or invalid JWT Bearer token.
- `FORBIDDEN` (HTTP 403): User role lacks permission for the requested action or department.
- `NOT_FOUND` (HTTP 404): Requested entity does not exist.
- `CONFLICT` (HTTP 409): Duplicate unique key violation (e.g., duplicate machine code, email).
- `SERVER_ERROR` (HTTP 500): Internal unhandled server exception.

### Date & Timestamp Formats
- **Calendar Dates:** `YYYY-MM-DD` (e.g. `2026-11-05`).
- **Timestamps:** ISO 8601 UTC with `Z` timezone (e.g. `2026-11-05T14:30:00Z`).
- **Times:** 24-hour `HH:MM` format (e.g. `06:00`, `14:30`).

### Standard Units & Metric Representation
- **Energy:** `kWh` (float, 2 decimal places).
- **Quantities:** `KG` or `LITRE` (float, 2 decimal places).
- **Percentages:** Floating-point number between `0.0` and `100.0` (e.g., `97.5`).

---

## 2. Roles & Permissions (Section D)

| Role | Permissions & Scoping |
| :--- | :--- |
| `EMPLOYEE` | Creates records (energy, hygiene, production, waste). Views only records they entered (`entered_by = user.id`). Can update records only while status is `PENDING` or `CORRECTION_REQUESTED`. |
| `SUPERVISOR` | All Employee permissions. Views all records within their assigned department (`department_id`). Reviews pending items (`APPROVE`, `REJECT`, `REQUEST_CORRECTION`). |
| `MANAGER` | Global administrative access across all departments. Approves/rejects any record. Confirms or dismisses anomaly alerts. Manages users, master data, and audits. |

---

## 3. Endpoints Specification

### 3.1 Authentication
- **`POST /api/v1/auth/login`**
  - Public endpoint.
  - Body: `{ "email": "employee@smarttrust.demo", "password": "Demo@1234" }`
  - Returns: `{ "success": true, "data": { "token": "jwt...", "user": { "id": 1, "full_name": "Ramesh Kumar", "email": "...", "role": "EMPLOYEE", "department_id": 1 } } }`
- **`GET /api/v1/auth/me`**
  - Requires `Bearer` token. Returns current authenticated user profile.
- **`POST /api/v1/auth/logout`**
  - Requires `Bearer` token. Invalidates session.

---

### 3.2 Master Data (GET for All, POST/PUT for MANAGER)
- `GET/POST /api/v1/departments`
- `GET/POST /api/v1/machines`
- `GET/POST /api/v1/areas`
- `GET/POST /api/v1/sanitation-schedules`
- `GET/POST /api/v1/products`
- `GET/POST /api/v1/materials`

---

### 3.3 User Management (MANAGER Only)
- `GET /api/v1/users` (Query: `role`, `department_id`, `page`, `pageSize`)
- `POST /api/v1/users` (Body: `{ full_name, email, password, role, department_id }`)
- `PUT /api/v1/users/:id` (Update user status, role, or department)

---

### 3.4 Operational Records CRUD
Endpoints:
- `/api/v1/energy-records`
- `/api/v1/hygiene-records`
- `/api/v1/production-records`
- `/api/v1/waste-records`

Supported Methods:
- `GET /api/v1/<records>`: List with pagination (`page`, `pageSize`), status filter (`PENDING`, `APPROVED`, `REJECTED`, `CORRECTION_REQUESTED`), date range (`from`, `to`).
- `POST /api/v1/<records>`: Create new record. Always initialized with `status: PENDING`.
- `GET /api/v1/<records>/:id`: Get record details and full approval history.
- `PUT /api/v1/<records>/:id`: Update record. **Allowed ONLY when `status IN ('PENDING', 'CORRECTION_REQUESTED')` and `entered_by = authenticated_user.id`.** When resubmitted after correction request, status transitions to `PENDING` with an action of `RESUBMITTED` logged in `approval_history`.

---

### 3.5 Approval Workflow (SUPERVISOR, MANAGER)
- **`GET /api/v1/approvals/pending`**
  - Returns pending queue across all 4 record types (filtered by department for Supervisor, plant-wide for Manager).
- **`POST /api/v1/approvals/:recordType/:recordId/decision`**
  - Path Params: `recordType` (`energy`, `hygiene`, `production`, `waste`), `recordId` (integer).
  - Body:
    ```json
    {
      "decision": "APPROVE | REJECT | REQUEST_CORRECTION",
      "comment": "Required for REJECT and REQUEST_CORRECTION; optional for APPROVE"
    }
    ```
  - Side Effects:
    - Atomically updates record status and review fields (`reviewed_by`, `reviewed_at`, `review_comment`).
    - Appends entry into `approval_history`.
    - When `APPROVE` is granted, triggers automated background anomaly evaluation.
- **`GET /api/v1/approvals/history`**
  - Returns audit log of all approval actions.

---

### 3.6 Anomaly Alerts & Insights (Section G)
- **`GET /api/v1/alerts`**
  - Query Params: `status` (`OPEN`, `UNDER_REVIEW`, `CONFIRMED`, `DISMISSED`), `alert_type` (`ENERGY`, `HYGIENE`, `WASTE`), `severity` (`LOW`, `MEDIUM`, `HIGH`).
- **`GET /api/v1/alerts/:id`**
  - Returns full alert details including `explanation`, `evidence_json`, and `recommended_action`.
- **`POST /api/v1/alerts/:id/review`**
  - MANAGER only.
  - Body: `{ "status": "UNDER_REVIEW | CONFIRMED | DISMISSED", "comment": "Supervisor verified valve leak on separator." }`
  - **Honesty Rule:** An alert is only a "detected anomaly" until human manager confirms with `CONFIRMED`.
- **`GET /api/v1/insights/recommendations`**
  - Returns prioritized plain-language operational recommendations.

---

### 3.7 Dashboards (Section F & G)
- `GET /api/v1/dashboard/summary`: High-level counts for pending approvals, active alerts, overall plant compliance %, and today's energy consumption.
- `GET /api/v1/dashboard/energy-trend`: Daily aggregated kWh and baseline comparisons for approved records.
- `GET /api/v1/dashboard/hygiene-compliance`: Area-wise and plant-wide compliance percentages.
- `GET /api/v1/dashboard/waste-summary`: Product-wise production loss vs expected standards.

---

### 3.8 File Uploads & Bulk Imports
- `POST /api/v1/uploads`: Multipart form (`file`, `related_type`, `related_id`). Maximum size: 10 MB. Allowed MIME types: images (`jpeg`, `png`), documents (`pdf`), spreadsheets (`csv`, `xlsx`).
- `GET /api/v1/uploads/:id`: Authenticated file streaming.
- `POST /api/v1/imports/preview`: Uploads CSV/Excel sheet, validates against schema without writing to DB, and returns preview with row-level validation errors.
- `POST /api/v1/imports/commit`: Commits valid previewed rows atomically.

---

### 3.9 System Health
- **`GET /api/v1/health`**
  - Returns `{ "success": true, "data": { "status": "UP", "database": "CONNECTED", "timestamp": "..." } }`.
