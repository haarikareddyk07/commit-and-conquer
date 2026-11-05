-- Migration 001: Initial Schema
-- Creates all core tables for SmartTrust with CHECK constraints, foreign keys, and unique constraints.

PRAGMA foreign_keys = ON;

-- 1. Departments Master Table
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK(name IN ('Receiving', 'Pasteurisation', 'Packaging', 'Cold Storage', 'Cleaning')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 2. Users Table
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

-- 3. Machines Master Table
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

-- 4. Areas Master Table
CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    area_type TEXT NOT NULL CHECK(area_type IN ('EQUIPMENT', 'FLOOR', 'TANK', 'PIPELINE')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 5. Sanitation Schedules Master Table
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

-- 6. Products Master Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 7. Materials Master Table
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 8. Uploads Table
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

-- 9. Energy Records Table
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_machine_date_shift_active 
ON energy_records(machine_id, record_date, shift) 
WHERE status != 'REJECTED';

-- 10. Hygiene Records Table
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

-- 11. Production Records Table
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

-- 12. Waste Records Table
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

-- 13. Approval History Table
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

-- 14. Energy Baselines Table
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

-- 15. Alerts Table
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

-- 16. Audit Log Table
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

-- 17. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
