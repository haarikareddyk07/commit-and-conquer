# SmartTrust REST API Contract

## Overview
- **Base Path**: `/api/v1`
- **Default Port**: `5000`
- **Authentication**: Bearer JWT (`Authorization: Bearer <token>`) with 8-hour expiry.
- **Envelope Standard**: All responses use the unified JSON envelope.

---

## Response Envelopes

### 1. Success Envelope
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
<<<<<<< HEAD
    "total": 45,
    "page": 1,
    "pageSize": 20
=======
    "page": 1,
    "pageSize": 20,
    "total": 142
>>>>>>> origin/feature/integration-testing
  }
}
```

<<<<<<< HEAD
### 2. Error Envelope
=======
#### Error Response
>>>>>>> origin/feature/integration-testing
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
<<<<<<< HEAD
    "message": "End reading cannot be less than start reading",
    "details": [
      {
        "field": "reading_end_kwh",
        "message": "End reading cannot be less than start reading"
=======
    "message": "The submitted reading end value cannot be lower than reading start value.",
    "details": [
      {
        "field": "reading_end_kwh",
        "message": "reading_end_kwh must be greater than or equal to reading_start_kwh"
>>>>>>> origin/feature/integration-testing
      }
    ]
  }
}
```

<<<<<<< HEAD
Standard Error Codes:
- `VALIDATION_ERROR` (400)
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `SERVER_ERROR` (500)

---

## Endpoints

### 1. Authentication
- `POST /api/v1/auth/login` (Rate limited: 5 attempts per 15 minutes)
  - Request: `{ "email": "employee@smarttrust.demo", "password": "Demo@1234" }`
  - Response: `{ "token": "jwt...", "user": { "id": 1, "full_name": "...", "email": "...", "role": "EMPLOYEE" } }`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

### 2. Records (`/energy-records`, `/hygiene-records`, `/production-records`, `/waste-records`)
- `GET /api/v1/<type>-records`
  - Query parameters: `page`, `pageSize`, `status`, `from`, `to`
  - Permissions:
    - `EMPLOYEE`: Sees own records only
    - `SUPERVISOR`: Sees all records within their department
    - `MANAGER`: Sees all records
- `POST /api/v1/<type>-records`
  - Automatically computes `consumption_kwh = reading_end_kwh - reading_start_kwh` for energy records.
  - Automatically sets status to `PENDING`.
  - Automatically writes an `approval_history` row with action `SUBMITTED`.
- `GET /api/v1/<type>-records/:id`
- `PUT /api/v1/<type>-records/:id`
  - Allowed only while status is `PENDING` or `CORRECTION_REQUESTED`.
  - Allowed only by the original author.
  - Corrected records re-enter as `PENDING` with action `RESUBMITTED` in `approval_history`.

### 3. Approvals
- `GET /api/v1/approvals/pending`
  - Accessible to `SUPERVISOR` (scoped by department) and `MANAGER` (all).
- `POST /api/v1/approvals/:recordType/:recordId/decision`
  - Body: `{ "decision": "APPROVE" | "REJECT" | "REQUEST_CORRECTION", "comment": "..." }`
  - Comment is required for `REJECT` and `REQUEST_CORRECTION`.
  - Updates record status, `reviewed_by`, `reviewed_at`, `review_comment`, and inserts `approval_history` inside one transaction.
  - After `APPROVE`, calls analytics engine to recompute baselines and check for anomalies.
- `GET /api/v1/approvals/history`
  - Query parameters: `record_type`, `record_id`

### 4. Uploads
- `POST /api/v1/uploads`
  - Multipart: `file`, `related_type`, `related_id`
  - Allowed types: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.csv`, `.xlsx`
  - Max size: 10 MB.
  - Stored with randomly generated UUID filenames.
- `GET /api/v1/uploads/:id`
  - Authenticated stream download.

### 5. Imports
- `POST /api/v1/imports/preview`
  - Multipart: `file` (.csv or .xlsx), `type` (`energy`, `production`, `waste`).
  - Returns row-by-row preview with validation error markers.
- `POST /api/v1/imports/commit`
  - Body: `{ "type": "energy", "rows": [ ... ] }`
  - Commits only valid rows into database with status `PENDING` and history `SUBMITTED`.

### 6. Dashboard & Analytics
- `GET /api/v1/dashboard/summary`
  - Real database metrics: pending approvals count, open alerts count, today's energy vs baseline, hygiene compliance %, waste % this week.
- `GET /api/v1/dashboard/energy-trend`
  - Aggregated daily energy with baseline mean and upper band (+2 std dev).
- `GET /api/v1/dashboard/hygiene-compliance`
  - Compliance % by area (`approved_records / total_records * 100`).
- `GET /api/v1/dashboard/waste-summary`
  - Breakdown by waste type and product loss.

### 7. Alerts & Insights
- `GET /api/v1/alerts`
  - Filter by `status`, `severity`, `alert_type`, `from`, `to`.
- `GET /api/v1/alerts/:id`
- `POST /api/v1/alerts/:id/review`
  - Body: `{ "status": "UNDER_REVIEW" | "CONFIRMED" | "DISMISSED", "comment": "..." }`
- `GET /api/v1/insights/recommendations`
  - Rule-based preventative insights derived from open alerts and recurring patterns.

### 8. User Management (`MANAGER` only)
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id`

### 9. Master Data (`GET` for all, `POST`/`PUT` for `MANAGER`)
- `/api/v1/machines`
- `/api/v1/areas`
- `/api/v1/sanitation-schedules`
- `/api/v1/products`
- `/api/v1/materials`
- `/api/v1/departments`

### 10. Health
- `GET /api/v1/health`
  - Returns `{ "status": "UP", "timestamp": "...", "database": "CONNECTED" }`
=======
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
>>>>>>> origin/feature/integration-testing
