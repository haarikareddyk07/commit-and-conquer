# SmartTrust Backend REST API

REST API for the **SmartTrust Dairy Plant Management System**, built with Node.js, Express, SQLite, and Zod validation, strictly adhering to the Shared Contract.

---

## Features & Responsibilities

1. **Authentication & RBAC**:
   - Passwords hashed with `bcryptjs`.
   - Bearer JWT authentication with 8-hour expiry.
   - `authenticate` and `authorize(...roles)` middlewares.
   - Rate limiting on `/api/v1/auth/login` (5 attempts per 15 minutes).
   - Generic plain-language error messages on failed logins.
   - Roles: `EMPLOYEE`, `SUPERVISOR`, `MANAGER`.

2. **Data Access & Storage**:
   - Parameterised SQL queries only with `better-sqlite3`.
   - Zero ORM overhead.
   - Foreign keys enabled (`PRAGMA foreign_keys = ON`).
   - SQLite database located at `database/smarttrust.db`.

3. **Operational Records**:
   - Four domains: `energy`, `hygiene`, `production`, `waste`.
   - On creation: automatic calculation of `consumption_kwh`, status set to `PENDING`, and initial `approval_history` row marked `SUBMITTED`.
   - Ownership and scope enforcement (employees see own entries, supervisors see department records, managers see all).
   - Validation rejects impossible values (end reading < start, negative numbers, future dates, concentration outside 0–100%) with friendly error messages.
   - Author-only edits allowed only while record is in `PENDING` or `CORRECTION_REQUESTED`.
   - Corrected records re-enter as `PENDING` with history action `RESUBMITTED`.

4. **Approval Workflow**:
   - Queue scoped by role and department.
   - Transactional decision updates (`APPROVE`, `REJECT`, `REQUEST_CORRECTION`) recording reviewer metadata and history in one atomic transaction.
   - Post-approval hooks recompute analytics baselines and evaluate anomaly rules.

5. **Uploads & Imports**:
   - Secure Multer upload with 10 MB limit and filetype whitelist (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.csv`, `.xlsx`).
   - Random UUID storage filenames; access restricted to authenticated users.
   - CSV and Excel row-by-row validation preview before commit.

6. **Dashboard, Alerts & Explainable Analytics**:
   - Thin controllers calling SQL aggregates and analytics services.
   - Real data only; zero fake or hardcoded dashboard metrics.
   - Anomaly detection based on statistical baselines (mean + 2σ / 3σ).

7. **Security**:
   - `helmet` security headers.
   - Strict CORS policy restricted to `CORS_ORIGIN`.
   - Centralized error handler returning the standard contract envelope.
   - Comprehensive audit logging (`audit_log` table) for logins, decisions, and administrative changes.
   - Sensitive credentials and tokens strictly redacted from logs.

---

## Folder Structure

```
backend/
├── .env.example
├── .env
├── .gitignore
├── README.md
├── package.json
├── smarttrust.http         # Postman / REST Client requests
├── uploads/                # Uploaded attachments (git-ignored)
├── tests/                  # Supertest test suites
│   ├── approval.test.js
│   ├── auth.test.js
│   ├── endpoints.test.js
│   ├── permissions.test.js
│   └── validation.test.js
└── src/
    ├── server.js           # Server entry point
    ├── app.js              # Express app setup
    ├── config/             # Environment and Database configuration
    ├── routes/             # Express API route declarations
    ├── controllers/        # Thin HTTP controllers
    ├── services/           # Business logic & workflow services
    ├── repositories/       # Parameterised SQLite queries
    ├── middleware/         # Auth, validation, rate limiting, error handling
    ├── validators/         # Zod schemas & constraints
    ├── utils/              # Envelopes, error classes, sanitizing logger
    └── analytics/          # Explainable rule-based analytics engine
```

---

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
PORT=5000
NODE_ENV=development
JWT_SECRET=supersecretjwtkey_smarttrust_dairy_production_2026
DB_PATH=../database/smarttrust.db
UPLOAD_DIR=uploads
CORS_ORIGIN=http://localhost:5173
```

### 3. Seed Database
From the project root:
```bash
node database/seed.js
```

### 4. Start the Application
- **Development Mode** (with automatic reload):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

### 5. Run Automated Tests
Execute the comprehensive Supertest test suite:
```bash
npm test
```

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Employee | `employee@smarttrust.demo` | `Demo@1234` |
| Supervisor | `supervisor@smarttrust.demo` | `Demo@1234` |
| Manager | `manager@smarttrust.demo` | `Demo@1234` |

---

## Testing & Verification Summary
All 32 test cases across 5 test suites pass:
- `auth.test.js`: Login, rate limiting, JWT verification, profile retrieval, logout.
- `permissions.test.js`: RBAC enforcement across Employee, Supervisor, and Manager.
- `validation.test.js`: Constraint validation, date checks, range checks, and error envelopes.
- `approval.test.js`: Full record lifecycle from submission → correction request → resubmission → approval.
- `endpoints.test.js`: Live SQL aggregates, trends, compliance, imports preview/commit, and health checks.
