# SmartTrust Data Dictionary (Source of Truth)
**Version:** 1.0.0 | **Problem Statement ID:** DL-SJBIT-HK26-GOVP010  
**Storage Engine:** SQLite 3 (via `better-sqlite3`) | **Database Path:** `database/smarttrust.db`

---

## 1. Design Rules & Standards
1. **Naming Conventions:** All table names are lowercase plural nouns (`users`, `energy_records`). All column names are snake_case (`reading_start_kwh`).
2. **Primary Keys:** Every table has an integer primary key `id INTEGER PRIMARY KEY AUTOINCREMENT`.
3. **Audit Timestamp:** Every table has `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`.
4. **Relational Integrity:** Foreign keys are strictly enforced with `PRAGMA foreign_keys = ON`.
5. **No Cascading Deletion of Historical Records:** Deletion of parent entities (machines, users, areas) is protected with `ON DELETE RESTRICT` or `ON DELETE SET NULL` to preserve historical plant audit trails.

---

## 2. Entity Tables

### 2.1 `departments`
Master classification of factory operational zones.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique department identifier |
| `name` | TEXT | NOT NULL, UNIQUE, CHECK | Allowed: `'Receiving'`, `'Pasteurisation'`, `'Packaging'`, `'Cold Storage'`, `'Cleaning'` |
| `created_at` | TEXT | NOT NULL | UTC ISO 8601 timestamp |

### 2.2 `users`
Plant personnel accounts with role-based access.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique user identifier |
| `full_name` | TEXT | NOT NULL | User's full name |
| `email` | TEXT | NOT NULL, UNIQUE | User login email address |
| `password_hash` | TEXT | NOT NULL | Bcrypt salt-hashed password |
| `role` | TEXT | NOT NULL, CHECK | Allowed: `'EMPLOYEE'`, `'SUPERVISOR'`, `'MANAGER'` |
| `department_id` | INTEGER | FK -> `departments(id)` | Assigned department (NULL for plant-wide managers) |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Account active status (`0` or `1`) |
| `created_at` | TEXT | NOT NULL | UTC ISO 8601 timestamp |

### 2.3 `machines`
Factory machinery monitored for energy consumption and runtime.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique machine identifier |
| `machine_code` | TEXT | NOT NULL, UNIQUE | Plant code (e.g., `'PST-01'`, `'CHL-01'`) |
| `name` | TEXT | NOT NULL | Descriptive name (e.g., `'HTST Pasteuriser 01'`) |
| `department_id` | INTEGER | NOT NULL, FK -> `departments(id)` | Operating department |
| `machine_type` | TEXT | NOT NULL | Equipment type (`'Pasteuriser'`, `'Chiller'`, `'Boiler'`, `'Homogeniser'`, etc.) |
| `rated_power_kw` | REAL | NOT NULL, CHECK >= 0 | Rated motor/heating power in kW |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Machine active status (`0` or `1`) |
| `created_at` | TEXT | NOT NULL | UTC ISO 8601 timestamp |

### 2.4 `areas`
Plant physical zones subjected to scheduled sanitation.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique area identifier |
| `name` | TEXT | NOT NULL | Area name (e.g., `'Pasteuriser Line P1'`) |
| `department_id` | INTEGER | NOT NULL, FK -> `departments(id)` | Department managing the zone |
| `area_type` | TEXT | NOT NULL, CHECK | Allowed: `'EQUIPMENT'`, `'FLOOR'`, `'TANK'`, `'PIPELINE'` |
| `created_at` | TEXT | NOT NULL | UTC ISO 8601 timestamp |

### 2.5 `sanitation_schedules`
Mandated Cleaning-In-Place (CIP) and sanitation SOP schedules.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique schedule identifier |
| `area_id` | INTEGER | NOT NULL, FK -> `areas(id)` | Zone requiring sanitation |
| `task_name` | TEXT | NOT NULL | Task description (e.g., `'Alkaline CIP Wash'`) |
| `frequency` | TEXT | NOT NULL, CHECK | Allowed: `'DAILY'`, `'WEEKLY'`, `'PER_SHIFT'` |
| `shift` | TEXT | CHECK NULL OR IN | Allowed: `'MORNING'`, `'AFTERNOON'`, `'NIGHT'`, or NULL |
| `due_time` | TEXT | NOT NULL, CHECK GLOB | 24-hr time `HH:MM` |
| `grace_minutes` | INTEGER | NOT NULL, DEFAULT 30 | Allowed grace window before being marked LATE |
| `required_chemical` | TEXT | NOT NULL | Mandated sanitizing chemical |
| `min_concentration_percent` | REAL | NOT NULL, 0–100 | Minimum effective chemical concentration % |
| `max_concentration_percent` | REAL | NOT NULL, 0–100 | Maximum safe chemical concentration % |
| `min_contact_minutes` | INTEGER | NOT NULL, >= 0 | Minimum contact duration in minutes |
| `created_at` | TEXT | NOT NULL | UTC ISO 8601 timestamp |

### 2.6 `products` & `materials`
Finished goods and raw materials with acceptable shrinkage standards.
- `products`: `id`, `product_code`, `name`, `unit` (`'KG'` or `'LITRE'`), `expected_loss_percent` (0–100), `created_at`.
- `materials`: `id`, `material_code`, `name`, `unit`, `expected_loss_percent` (0–100), `created_at`.

---

## 3. Operational Record Tables

### 3.1 `energy_records`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | Unique record ID |
| `machine_id` | INTEGER | NOT NULL, FK -> `machines(id)` | Monitored machine |
| `entered_by` | INTEGER | NOT NULL, FK -> `users(id)` | Submitting employee |
| `record_date` | TEXT | NOT NULL, `YYYY-MM-DD` | Date of meter reading |
| `shift` | TEXT | NOT NULL, CHECK | `'MORNING'`, `'AFTERNOON'`, `'NIGHT'` |
| `reading_start_kwh` | REAL | NOT NULL, >= 0 | Initial meter reading |
| `reading_end_kwh` | REAL | NOT NULL, >= reading_start_kwh | Final meter reading |
| `consumption_kwh` | REAL | NOT NULL, GENERATED/STORED | Calculated: `reading_end_kwh - reading_start_kwh` |
| `runtime_hours` | REAL | NOT NULL, CHECK 0–24 | Operating hours during shift |
| `notes` | TEXT | NULLABLE | Operational notes |
| `status` | TEXT | NOT NULL, CHECK | `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'CORRECTION_REQUESTED'` |
| `reviewed_by` | INTEGER | NULLABLE, FK -> `users(id)` | Supervisor/Manager ID |
| `reviewed_at` | TEXT | NULLABLE | Review timestamp |
| `review_comment` | TEXT | NULLABLE | Explanation for review decision |
| `created_at` | TEXT | NOT NULL | UTC timestamp |

### 3.2 `hygiene_records`
Contains sanitation execution parameters and chemical checks.
- Columns: `id`, `schedule_id`, `area_id`, `entered_by`, `scheduled_date`, `completed_at`, `chemical_used`, `concentration_percent`, `contact_minutes`, `checklist_json`, `upload_id`, `notes`, `status`, `reviewed_by`, `reviewed_at`, `review_comment`, `created_at`.

### 3.3 `production_records`
Tracks batch production yields and input/output conversion.
- Columns: `id`, `product_id`, `batch_no`, `production_date`, `shift`, `raw_input_qty`, `actual_output_qty`, `unit`, `entered_by`, `notes`, `status`, `reviewed_by`, `reviewed_at`, `review_comment`, `created_at`.

### 3.4 `waste_records`
Specific material loss entries with assigned root causes.
- Columns: `id`, `production_record_id` (nullable), `material_id`, `record_date`, `shift`, `waste_type` (`'SPILLAGE'`, `'SPOILAGE'`, `'REJECT'`, `'CLEANING_LOSS'`, `'OTHER'`), `quantity`, `unit`, `cause`, `entered_by`, `status`, `reviewed_by`, `reviewed_at`, `review_comment`, `created_at`.

---

## 4. Workflows, Baselines & Alerts

### 4.1 `approval_history`
Audit ledger tracking every status change.
- Columns: `id`, `record_type` (`'energy'`, `'hygiene'`, `'production'`, `'waste'`), `record_id`, `action` (`'SUBMITTED'`, `'APPROVED'`, `'REJECTED'`, `'CORRECTION_REQUESTED'`, `'RESUBMITTED'`), `acted_by`, `comment`, `acted_at`.

### 4.2 `energy_baselines`
Pre-calculated historical baselines for each machine and shift.
- Columns: `id`, `machine_id`, `shift`, `mean_kwh`, `std_dev_kwh`, `sample_count`, `calculated_at`.

### 4.3 `alerts`
Detected anomalies flagged for managerial review.
- Columns: `id`, `alert_type` (`'ENERGY'`, `'HYGIENE'`, `'WASTE'`), `source_record_type`, `source_record_id`, `severity` (`'LOW'`, `'MEDIUM'`, `'HIGH'`), `status` (`'OPEN'`, `'UNDER_REVIEW'`, `'CONFIRMED'`, `'DISMISSED'`), `title`, `explanation`, `evidence_json`, `recommended_action`, `detected_at`, `reviewed_by`, `reviewed_at`, `review_comment`, `created_at`.

### 4.4 `audit_log`
System security and sensitive activity logging.
- Columns: `id`, `user_id`, `action`, `entity`, `entity_id`, `ip_address`, `acted_at`.
