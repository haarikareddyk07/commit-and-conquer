-- ============================================================================
-- SmartTrust Dairy Plant Management System - Database Schema
-- Problem ID: DL-SJBIT-HK26-GOVP010
-- SQLite 3 (via better-sqlite3)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Departments Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK(name IN ('Receiving', 'Pasteurisation', 'Packaging', 'Cold Storage', 'Cleaning')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 2. Users Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER')),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 3. Machines Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    machine_type TEXT NOT NULL,
    rated_power_kw REAL NOT NULL CHECK(rated_power_kw >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 4. Areas Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    area_type TEXT NOT NULL CHECK(area_type IN ('EQUIPMENT', 'FLOOR', 'TANK', 'PIPELINE')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 5. Sanitation Schedules Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sanitation_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    task_name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('DAILY', 'WEEKLY', 'PER_SHIFT')),
    shift TEXT CHECK(shift IS NULL OR shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    due_time TEXT NOT NULL CHECK(due_time GLOB '[0-2][0-9]:[0-5][0-9]'),
    grace_minutes INTEGER NOT NULL DEFAULT 30 CHECK(grace_minutes >= 0),
    required_chemical TEXT NOT NULL,
    min_concentration_percent REAL NOT NULL CHECK(min_concentration_percent >= 0 AND min_concentration_percent <= 100),
    max_concentration_percent REAL NOT NULL CHECK(max_concentration_percent >= 0 AND max_concentration_percent <= 100),
    min_contact_minutes INTEGER NOT NULL CHECK(min_contact_minutes >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_concentration_range CHECK(max_concentration_percent >= min_concentration_percent)
);

-- ----------------------------------------------------------------------------
-- 6. Products Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 7. Materials Master Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 8. Uploads Table (referenced by hygiene_records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    related_type TEXT CHECK(related_type IS NULL OR related_type IN ('energy', 'hygiene', 'production', 'waste')),
    related_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 9. Energy Records Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    record_date TEXT NOT NULL CHECK(record_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    reading_start_kwh REAL NOT NULL CHECK(reading_start_kwh >= 0),
    reading_end_kwh REAL NOT NULL CHECK(reading_end_kwh >= 0),
    consumption_kwh REAL NOT NULL CHECK(consumption_kwh >= 0),
    runtime_hours REAL NOT NULL CHECK(runtime_hours >= 0 AND runtime_hours <= 24),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_energy_reading_end_gte_start CHECK(reading_end_kwh >= reading_start_kwh)
);

-- Partial Unique Constraint: Only one active/approved/pending record per machine, date and shift unless status is REJECTED
CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_machine_date_shift_active 
ON energy_records(machine_id, record_date, shift) 
WHERE status != 'REJECTED';

-- ----------------------------------------------------------------------------
-- 10. Hygiene Records Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hygiene_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES sanitation_schedules(id) ON DELETE RESTRICT,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scheduled_date TEXT NOT NULL CHECK(scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    completed_at TEXT NOT NULL,
    chemical_used TEXT NOT NULL,
    concentration_percent REAL NOT NULL CHECK(concentration_percent >= 0 AND concentration_percent <= 100),
    contact_minutes INTEGER NOT NULL CHECK(contact_minutes >= 0),
    checklist_json TEXT,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 11. Production Records Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_no TEXT NOT NULL UNIQUE,
    production_date TEXT NOT NULL CHECK(production_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    raw_input_qty REAL NOT NULL CHECK(raw_input_qty >= 0),
    actual_output_qty REAL NOT NULL CHECK(actual_output_qty >= 0),
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 12. Waste Records Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waste_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_record_id INTEGER REFERENCES production_records(id) ON DELETE RESTRICT,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    record_date TEXT NOT NULL CHECK(record_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    waste_type TEXT NOT NULL CHECK(waste_type IN ('SPILLAGE', 'SPOILAGE', 'REJECT', 'CLEANING_LOSS', 'OTHER')),
    quantity REAL NOT NULL CHECK(quantity >= 0),
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    cause TEXT NOT NULL,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 13. Approval History Table (Immutable Audit of State Transitions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL CHECK(record_type IN ('energy', 'hygiene', 'production', 'waste')),
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'RESUBMITTED')),
    acted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    comment TEXT,
    acted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 14. Energy Baselines Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_baselines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    mean_kwh REAL NOT NULL CHECK(mean_kwh >= 0),
    std_dev_kwh REAL NOT NULL CHECK(std_dev_kwh >= 0),
    sample_count INTEGER NOT NULL CHECK(sample_count >= 0),
    calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(machine_id, shift)
);

-- ----------------------------------------------------------------------------
-- 15. Alerts Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('ENERGY', 'HYGIENE', 'WASTE')),
    source_record_type TEXT NOT NULL CHECK(source_record_type IN ('energy', 'hygiene', 'production', 'waste')),
    source_record_id INTEGER NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED')),
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 16. Audit Log Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    ip_address TEXT,
    acted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 17. Schema Migrations Table (Tracks applied migrations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================================
-- Indexes for Main Queries
-- ============================================================================

-- Records by status and date
CREATE INDEX IF NOT EXISTS idx_energy_records_status_date ON energy_records(status, record_date);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_status_date ON hygiene_records(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_production_records_status_date ON production_records(status, production_date);
CREATE INDEX IF NOT EXISTS idx_waste_records_status_date ON waste_records(status, record_date);

-- Records by user
CREATE INDEX IF NOT EXISTS idx_energy_records_user ON energy_records(entered_by);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_user ON hygiene_records(entered_by);
CREATE INDEX IF NOT EXISTS idx_production_records_user ON production_records(entered_by);
CREATE INDEX IF NOT EXISTS idx_waste_records_user ON waste_records(entered_by);

-- Records by machine / area
CREATE INDEX IF NOT EXISTS idx_energy_records_machine ON energy_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_area ON hygiene_records(area_id);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_schedule ON hygiene_records(schedule_id);

-- Alerts by status and severity, and by source record
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type_status ON alerts(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source_record_type, source_record_id);

-- Approval history by record and acted_by
CREATE INDEX IF NOT EXISTS idx_approval_history_record ON approval_history(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_acted_by ON approval_history(acted_by);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_acted_at ON audit_log(user_id, acted_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);

-- ============================================================================
-- SQL Views
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: v_pending_approvals
-- Aggregates all records in PENDING or CORRECTION_REQUESTED status across all 4 types
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_pending_approvals AS
SELECT 
    'energy' AS record_type,
    er.id AS record_id,
    er.record_date AS record_date,
    er.shift AS shift,
    er.entered_by AS entered_by,
    u.full_name AS entered_by_name,
    m.department_id AS department_id,
    d.name AS department_name,
    er.status AS status,
    er.created_at AS created_at,
    'Machine: ' || m.name || ' (' || m.machine_code || ') - Consumption: ' || er.consumption_kwh || ' kWh' AS summary
FROM energy_records er
JOIN machines m ON er.machine_id = m.id
JOIN departments d ON m.department_id = d.id
JOIN users u ON er.entered_by = u.id
WHERE er.status IN ('PENDING', 'CORRECTION_REQUESTED')

UNION ALL

SELECT 
    'hygiene' AS record_type,
    hr.id AS record_id,
    hr.scheduled_date AS record_date,
    ss.shift AS shift,
    hr.entered_by AS entered_by,
    u.full_name AS entered_by_name,
    a.department_id AS department_id,
    d.name AS department_name,
    hr.status AS status,
    hr.created_at AS created_at,
    'Area: ' || a.name || ' - Task: ' || ss.task_name || ' (' || hr.chemical_used || ' ' || hr.concentration_percent || '%)' AS summary
FROM hygiene_records hr
JOIN areas a ON hr.area_id = a.id
JOIN sanitation_schedules ss ON hr.schedule_id = ss.id
JOIN departments d ON a.department_id = d.id
JOIN users u ON hr.entered_by = u.id
WHERE hr.status IN ('PENDING', 'CORRECTION_REQUESTED')

UNION ALL

SELECT 
    'production' AS record_type,
    pr.id AS record_id,
    pr.production_date AS record_date,
    pr.shift AS shift,
    pr.entered_by AS entered_by,
    u.full_name AS entered_by_name,
    u.department_id AS department_id,
    COALESCE(d.name, 'Production') AS department_name,
    pr.status AS status,
    pr.created_at AS created_at,
    'Product: ' || p.name || ' - Batch: ' || pr.batch_no || ' (Output: ' || pr.actual_output_qty || ' ' || pr.unit || ')' AS summary
FROM production_records pr
JOIN products p ON pr.product_id = p.id
JOIN users u ON pr.entered_by = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE pr.status IN ('PENDING', 'CORRECTION_REQUESTED')

UNION ALL

SELECT 
    'waste' AS record_type,
    wr.id AS record_id,
    wr.record_date AS record_date,
    wr.shift AS shift,
    wr.entered_by AS entered_by,
    u.full_name AS entered_by_name,
    u.department_id AS department_id,
    COALESCE(d.name, 'Waste') AS department_name,
    wr.status AS status,
    wr.created_at AS created_at,
    'Material: ' || mat.name || ' - ' || wr.waste_type || ': ' || wr.quantity || ' ' || wr.unit || ' (' || wr.cause || ')' AS summary
FROM waste_records wr
JOIN materials mat ON wr.material_id = mat.id
JOIN users u ON wr.entered_by = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE wr.status IN ('PENDING', 'CORRECTION_REQUESTED');

-- ----------------------------------------------------------------------------
-- View: v_energy_daily_by_machine
-- Aggregates daily energy consumption and runtime for APPROVED records
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_energy_daily_by_machine AS
SELECT 
    m.id AS machine_id,
    m.machine_code AS machine_code,
    m.name AS machine_name,
    m.machine_type AS machine_type,
    m.rated_power_kw AS rated_power_kw,
    d.id AS department_id,
    d.name AS department_name,
    er.record_date AS record_date,
    ROUND(SUM(er.consumption_kwh), 2) AS total_consumption_kwh,
    ROUND(SUM(er.runtime_hours), 2) AS total_runtime_hours,
    COUNT(er.id) AS shift_count,
    CASE 
        WHEN SUM(er.runtime_hours) > 0 THEN ROUND(SUM(er.consumption_kwh) / SUM(er.runtime_hours), 2)
        ELSE 0 
    END AS avg_kw_load
FROM energy_records er
JOIN machines m ON er.machine_id = m.id
JOIN departments d ON m.department_id = d.id
WHERE er.status = 'APPROVED'
GROUP BY m.id, m.machine_code, m.name, m.machine_type, m.rated_power_kw, d.id, d.name, er.record_date;

-- ----------------------------------------------------------------------------
-- View: v_hygiene_compliance_by_area
-- Calculates compliance metrics for hygiene inspections across areas
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_hygiene_compliance_by_area AS
SELECT 
    a.id AS area_id,
    a.name AS area_name,
    a.area_type AS area_type,
    d.id AS department_id,
    d.name AS department_name,
    COUNT(hr.id) AS total_records,
    SUM(CASE WHEN hr.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_records,
    SUM(CASE WHEN hr.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_records,
    SUM(CASE WHEN hr.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_records,
    SUM(CASE WHEN hr.status = 'CORRECTION_REQUESTED' THEN 1 ELSE 0 END) AS correction_requested_records,
    ROUND(
        CASE 
            WHEN COUNT(hr.id) > 0 THEN (CAST(SUM(CASE WHEN hr.status = 'APPROVED' THEN 1 ELSE 0 END) AS REAL) / COUNT(hr.id)) * 100.0
            ELSE 0.0 
        END, 
        1
    ) AS compliance_percent
FROM areas a
JOIN departments d ON a.department_id = d.id
LEFT JOIN hygiene_records hr ON a.id = hr.area_id
GROUP BY a.id, a.name, a.area_type, d.id, d.name;

-- ----------------------------------------------------------------------------
-- View: v_waste_by_product
-- Reconciles production losses against expected loss standards by product
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_waste_by_product AS
SELECT 
    p.id AS product_id,
    p.product_code AS product_code,
    p.name AS product_name,
    p.unit AS unit,
    p.expected_loss_percent AS expected_loss_percent,
    COUNT(pr.id) AS approved_batch_count,
    ROUND(COALESCE(SUM(pr.raw_input_qty), 0), 2) AS total_raw_input_qty,
    ROUND(COALESCE(SUM(pr.actual_output_qty), 0), 2) AS total_actual_output_qty,
    ROUND(COALESCE(SUM(pr.raw_input_qty - pr.actual_output_qty), 0), 2) AS total_production_loss_qty,
    ROUND(
        CASE 
            WHEN SUM(pr.raw_input_qty) > 0 THEN 
                ((SUM(pr.raw_input_qty) - SUM(pr.actual_output_qty)) / SUM(pr.raw_input_qty)) * 100.0
            ELSE 0.0 
        END, 
        2
    ) AS actual_loss_percent,
    ROUND(
        COALESCE(
            (SELECT SUM(wr.quantity) 
             FROM waste_records wr 
             JOIN production_records pr2 ON wr.production_record_id = pr2.id 
             WHERE pr2.product_id = p.id AND wr.status = 'APPROVED'),
            0
        ), 
        2
    ) AS total_logged_waste_qty
FROM products p
LEFT JOIN production_records pr ON p.id = pr.product_id AND pr.status = 'APPROVED'
GROUP BY p.id, p.product_code, p.name, p.unit, p.expected_loss_percent;
