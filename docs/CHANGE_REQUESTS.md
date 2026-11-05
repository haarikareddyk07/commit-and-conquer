# SmartTrust Change Requests Ledger (QA & Integration)
**Owner:** Member 5 (QA & Integration Engineer) | **Branch:** `feature/integration-testing`  
**Purpose:** Formal change requests and contract discrepancy notifications for peer branches. Do not modify other members' source files; resolve issues via this ledger.

---

## Change Request Summary

| CR ID | Target Branch | Owning Member | Priority | Topic | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **CR-001** | `feature/ai-analytics` | Member 4 | **HIGH** | Directory Structure Alignment (`backend/src/analytics/`) | OPEN |
| **CR-002** | `feature/backend` | Member 2 | **MEDIUM** | SQLite DB Path Resolution Across Workspaces | OPEN |
| **CR-003** | `feature/frontend` | Member 1 | **MEDIUM** | Client-Side Upload Constraints & MIME Validation | OPEN |
| **CR-004** | `feature/database` | Member 3 | **LOW** | Dynamic Trigger for Energy Baseline Recalculation | OPEN |

---

### CR-001: Analytics Module Folder Placement
- **Target Branch:** `feature/ai-analytics`
- **Component:** `backend/src/analytics/`
- **Severity:** HIGH (Structural Contract Mismatch)
- **Problem Description:**
  Section B of the Shared Contract specifies:
  > `backend/src/analytics/ – Member 4, branch feature/ai-analytics`
  Currently, Member 4 implemented the analytics engine directly in root `analytics/`.
- **Reproduction Steps:**
  1. Inspect root folder tree on `feature/ai-analytics`.
  2. Observe `analytics/` folder containing Python engine, sample data, and tests.
  3. Verify that `backend/src/analytics/` does not exist.
- **Recommended Fix:**
  During the merge phase (Step 3 in `docs/MERGE_LOG.md`), copy or symlink the verified analytics package into `backend/src/analytics/` and expose a Node/Express bridge (`child_process.spawn` or REST client) so Express controllers can invoke it cleanly.

---

### CR-002: SQLite Database Path Resolution in Backend
- **Target Branch:** `feature/backend`
- **Component:** `backend/src/db.js` (or database connector)
- **Severity:** MEDIUM (Runtime Configuration Risk)
- **Problem Description:**
  Depending on how the server is launched (`npm run dev` from root vs `npm start` inside `backend/`), relative paths like `database/smarttrust.db` may fail to resolve, causing `better-sqlite3` to create a new empty database file.
- **Reproduction Steps:**
  1. Run `cd backend && node src/server.js`.
  2. Relative path `database/smarttrust.db` attempts to find `backend/database/smarttrust.db` instead of the root `database/smarttrust.db`.
- **Recommended Fix:**
  Standardize the database path resolver:
  ```javascript
  const path = require('path');
  const dbPath = process.env.DB_PATH 
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(__dirname, '../../database/smarttrust.db');
  ```

---

### CR-003: Client-Side Upload Validation & Mobile Constraints
- **Target Branch:** `feature/frontend`
- **Component:** File upload modal / forms
- **Severity:** MEDIUM (UX & Network Waste)
- **Problem Description:**
  Section F restricts uploads to 10 MB and specific formats (PDF, CSV, Excel, PNG, JPG). Without client-side pre-validation, oversized files waste mobile bandwidth before failing at multer.
- **Reproduction Steps:**
  1. Attempt to upload a 25 MB file in the employee upload dialog.
  2. Wait for full upload stream before receiving HTTP 400.
- **Recommended Fix:**
  Add client-side size check (`file.size <= 10 * 1024 * 1024`) and HTML input attribute `accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg"` to prevent invalid file selection.

---

### CR-004: Dynamic Energy Baseline Recalculation
- **Target Branch:** `feature/database` / `feature/backend`
- **Component:** `energy_baselines` table
- **Severity:** LOW (Automation Enhancement)
- **Problem Description:**
  Section G states that baselines are derived from the last 30 `APPROVED` records. Currently, `energy_baselines` contains seeded rows from `seed.js`.
- **Recommended Fix:**
  Ensure the backend approval controller or an SQLite trigger updates `energy_baselines` whenever an energy record is approved and has $\ge 5$ approved samples.
