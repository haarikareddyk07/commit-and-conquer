# SmartTrust REST API Contract

## Overview
- **Base Path**: `/api/v1`
- **Default Port**: `5000`
- **Authentication**: Bearer JWT (`Authorization: Bearer <token>`) with 8-hour expiry.
- **Envelope Standard**: All responses use the unified JSON envelope.

---

## Response Envelopes

### 1. Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 45,
    "page": 1,
    "pageSize": 20
  }
}
```

### 2. Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End reading cannot be less than start reading",
    "details": [
      {
        "field": "reading_end_kwh",
        "message": "End reading cannot be less than start reading"
      }
    ]
  }
}
```

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
