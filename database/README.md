# SmartTrust Dairy Plant Management System - Database Layer

The SQLite database layer for **SmartTrust** (Problem ID: `DL-SJBIT-HK26-GOVP010`), designed for plain SQL access via `better-sqlite3` in Node.js 20.

---

## 1. Directory Structure

```text
database/
├── smarttrust.db            # Active SQLite database file (WAL mode enabled)
├── schema.sql               # Complete monolithic schema definition with all DDL, checks, indexes & views
├── migrate.js               # Migration runner that applies migrations once and records them
├── seed.js                  # Deterministic idempotent dairy plant seeder (45 days historical + anomalies)
├── reset.js                 # Complete database wipe, migration re-run, and re-seed
├── test-constraints.js      # Constraint validation test suite (FKs, CHECKs, unique, partial index, views)
├── package.json             # Database module scripts & dependencies
├── README.md                # Backup, recovery, and operational procedures
└── migrations/              # Numbered migration scripts
    ├── 001_initial_schema.sql
    ├── 002_indexes.sql
    └── 003_views.sql
```

---

## 2. Quick Start & NPM Scripts

From the repository root (`smarttrust/`):

```bash
# Run migrations (applies any unapplied migration in database/migrations/)
npm run db:migrate

# Seed master data, demo users, and 45 days of plausible operations
npm run db:seed

# Full reset: wipe database file, run migrations from scratch, seed data
npm run db:reset

# Run constraint validation tests (22 assertions)
npm run db:test

# Run full database verification suite (72 assertions across schema, data, CRUD, and performance)
npm run db:verify
```

Alternatively, from the `database/` folder:
```bash
npm run reset
npm run test
```

---

## 3. Data Integrity & Constraints

- **Foreign Keys**: Enabled at all times (`PRAGMA foreign_keys = ON;`).
- **Cascade Deletion Policy**: `ON DELETE RESTRICT` is enforced across all operational records, uploads, and approval history to prevent accidental data deletion or loss of audit trails.
- **Enums**: Validated via strict SQL `CHECK` constraints:
  - **Roles**: `EMPLOYEE`, `SUPERVISOR`, `MANAGER`
  - **Record Statuses**: `PENDING`, `APPROVED`, `REJECTED`, `CORRECTION_REQUESTED`
  - **Alert Statuses**: `OPEN`, `UNDER_REVIEW`, `CONFIRMED`, `DISMISSED`
  - **Severity**: `LOW`, `MEDIUM`, `HIGH`
  - **Alert Types**: `ENERGY`, `HYGIENE`, `WASTE`
  - **Shifts**: `MORNING`, `AFTERNOON`, `NIGHT`
  - **Waste Types**: `SPILLAGE`, `SPOILAGE`, `REJECT`, `CLEANING_LOSS`, `OTHER`
  - **Approval Actions**: `SUBMITTED`, `APPROVED`, `REJECTED`, `CORRECTION_REQUESTED`, `RESUBMITTED`
- **Numeric Checks**:
  - `reading_end_kwh >= reading_start_kwh` (prevents meter rollback errors)
  - `consumption_kwh >= 0`
  - `concentration_percent` between `0.0` and `100.0`
  - `runtime_hours` between `0.0` and `24.0`
  - `expected_loss_percent` between `0.0` and `100.0`
  - `rated_power_kw >= 0`, `raw_input_qty >= 0`, `actual_output_qty >= 0`, `quantity >= 0`
- **Unique Constraints**:
  - `users.email`
  - `machines.machine_code`
  - `products.product_code`
  - `materials.material_code`
  - `production_records.batch_no`
  - `energy_baselines(machine_id, shift)`
- **Conditional Re-entry (Partial Unique Index)**:
  `uq_energy_machine_date_shift_active` enforces only one record per `(machine_id, record_date, shift)` **WHERE status != 'REJECTED'**. If a record is rejected, employees can re-submit a new record for that same shift.

---

## 4. SQL Views

1. **`v_pending_approvals`**:
   Unifies all pending records across `energy`, `hygiene`, `production`, and `waste` requiring manager or supervisor approval or corrections.
2. **`v_energy_daily_by_machine`**:
   Aggregates total daily energy consumption (`total_consumption_kwh`), runtime, and average kW load for all `APPROVED` records.
3. **`v_hygiene_compliance_by_area`**:
   Calculates compliance percentages (`compliance_percent = approved_records / total_records * 100`) and task breakdowns per plant area.
4. **`v_waste_by_product`**:
   Reconciles raw input vs. output production losses against the official product expected loss benchmarks, and compares them with logged waste records.

---

## 5. Seed Data & Demo Accounts

All seed data is generated deterministically using a fixed-seed Mulberry32 PRNG. Running `db:seed` generates identical records every time.

### Demo Users (Shared Contract H)
All passwords are stored exclusively as bcrypt hashes (rounds = 10). Password for all demo accounts: **`Demo@1234`**.

| Name | Email | Role | Department |
| :--- | :--- | :--- | :--- |
| **Ramesh Kumar** | `employee@smarttrust.demo` | `EMPLOYEE` | Pasteurisation |
| **Priya Sharma** | `supervisor@smarttrust.demo` | `SUPERVISOR` | Pasteurisation |
| **Vikram Malhotra** | `manager@smarttrust.demo` | `MANAGER` | Pasteurisation |

### Plant Master Data
- **Departments**: Receiving, Pasteurisation, Packaging, Cold Storage, Cleaning
- **Machines**:
  - `PST-01`: HTST Pasteuriser 01 (45 kW)
  - `HOM-01`: High Pressure Homogeniser 01 (30 kW)
  - `CHL-01`: Glycol Industrial Chiller 01 (55 kW)
  - `FIL-01`: Aseptic Pouch Filling Line 01 (22.5 kW)
  - `CIP-01`: Automated Central CIP Unit 01 (37 kW)
- **Products**:
  - `PRD-MLK`: Pasteurised Toned Milk (Expected loss: 1.5%)
  - `PRD-CRD`: Standard Curd (Expected loss: 2.0%)
  - `PRD-BTR`: Table Butter (Expected loss: 3.5%)
  - `PRD-PNR`: Fresh Paneer (Expected loss: 4.0%)

### Planted Operational Deviations (Demo Anomaly Scenarios)
1. **High Energy Day (HIGH Alert)**:
   - Date: `2026-11-04`, Shift: `MORNING`
   - Machine: `PST-01` consumed **412.0 kWh** (baseline mean: 290.4 kWh, std dev: 12.15 kWh). Exceeds `mean + 3·std` (326.85 kWh) by 26.1%.
2. **Chiller Load Warning (MEDIUM Alert)**:
   - Date: `2026-11-04`, Shift: `AFTERNOON`
   - Machine: `CHL-01` consumed **388.5 kWh** (baseline mean: 348.0 kWh). Exceeds `mean + 2·std` (376.4 kWh).
3. **Hygiene Non-Compliance (HIGH Alert & CORRECTION_REQUESTED)**:
   - Date: `2026-11-04`, Area: `Pasteuriser Line P1`, Task: `CIP Alkaline Wash`
   - Caustic concentration was **0.80%** (mandatory minimum: 1.50%), contact time was **12 minutes** (mandatory minimum: 20 minutes).
4. **Excessive Waste Batch (HIGH Alert)**:
   - Date: `2026-11-05`, Batch: `BAT-BTR-20261105-01`
   - Table Butter batch with **9.17% loss** (110 kg lost from 1200 kg) vs. standard 3.50% (2.62× expected). Includes 75 kg spillage from churn seal rupture.

---

## 6. Backup & Restore Procedures

### Database WAL Mode
SmartTrust enables SQLite Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) for high concurrency. In this mode, active data may reside across `smarttrust.db`, `smarttrust.db-wal`, and `smarttrust.db-shm`.

### Safe Online Backup
To take a safe, consistent live snapshot without stopping the backend:

```bash
# Using SQLite VACUUM INTO (works online during active transactions)
node -e "
const Database = require('better-sqlite3');
const db = new Database('database/smarttrust.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = 'database/backups/smarttrust_' + timestamp + '.db';
const fs = require('fs');
fs.mkdirSync('database/backups', { recursive: true });
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec(\`VACUUM INTO '\${backupPath}'\`);
console.log('Online backup created at: ' + backupPath);
db.close();
"
```

### Cold Backup (When Application is Idle)
1. Stop the backend service.
2. Checkpoint WAL: Ensure `smarttrust.db-wal` is checkpointed or copy all three files:
   - `smarttrust.db`
   - `smarttrust.db-wal` (if present)
   - `smarttrust.db-shm` (if present)
3. Store the archive in a secure backup repository.

### Restoring from Backup
1. Stop backend services.
2. Remove any existing `smarttrust.db*` files.
3. Copy the backup `.db` file into `database/smarttrust.db`.
4. Run validation: `npm run db:test`.
5. Start services.

---

## 7. Troubleshooting & Verification

To verify database health at any time:
```bash
npm run db:test
```
All 22 automated constraint checks will execute, certifying foreign keys, check bounds, unique index rules, and view queries.
