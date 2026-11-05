-- SmartTrust Database Schema
-- SQLite schema matching Shared Contract Section E

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER')),
    department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

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

CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    area_type TEXT NOT NULL CHECK(area_type IN ('EQUIPMENT', 'FLOOR', 'TANK', 'PIPELINE')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sanitation_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    task_name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('DAILY', 'WEEKLY', 'PER_SHIFT')),
    shift TEXT CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    due_time TEXT NOT NULL, -- HH:MM format
    grace_minutes INTEGER NOT NULL DEFAULT 30 CHECK(grace_minutes >= 0),
    required_chemical TEXT NOT NULL,
    min_concentration_percent REAL NOT NULL CHECK(min_concentration_percent >= 0 AND min_concentration_percent <= 100),
    max_concentration_percent REAL NOT NULL CHECK(max_concentration_percent >= 0 AND max_concentration_percent <= 100 AND max_concentration_percent >= min_concentration_percent),
    min_contact_minutes INTEGER NOT NULL CHECK(min_contact_minutes >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    expected_loss_percent REAL NOT NULL CHECK(expected_loss_percent >= 0 AND expected_loss_percent <= 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    related_type TEXT,
    related_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS energy_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    record_date TEXT NOT NULL,
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    reading_start_kwh REAL NOT NULL CHECK(reading_start_kwh >= 0),
    reading_end_kwh REAL NOT NULL CHECK(reading_end_kwh >= reading_start_kwh),
    consumption_kwh REAL NOT NULL CHECK(consumption_kwh >= 0),
    runtime_hours REAL NOT NULL CHECK(runtime_hours >= 0 AND runtime_hours <= 24),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS hygiene_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES sanitation_schedules(id) ON DELETE RESTRICT,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scheduled_date TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    chemical_used TEXT NOT NULL,
    concentration_percent REAL NOT NULL CHECK(concentration_percent >= 0 AND concentration_percent <= 100),
    contact_minutes INTEGER NOT NULL CHECK(contact_minutes >= 0),
    checklist_json TEXT,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS production_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_no TEXT NOT NULL,
    production_date TEXT NOT NULL,
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    raw_input_qty REAL NOT NULL CHECK(raw_input_qty >= 0),
    actual_output_qty REAL NOT NULL CHECK(actual_output_qty >= 0),
    unit TEXT NOT NULL CHECK(unit IN ('KG', 'LITRE')),
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS waste_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_record_id INTEGER REFERENCES production_records(id) ON DELETE SET NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    record_date TEXT NOT NULL,
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    waste_type TEXT NOT NULL CHECK(waste_type IN ('SPILLAGE', 'SPOILAGE', 'REJECT', 'CLEANING_LOSS', 'OTHER')),
    quantity REAL NOT NULL CHECK(quantity >= 0),
    unit TEXT NOT NULL,
    cause TEXT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS approval_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL CHECK(record_type IN ('energy', 'hygiene', 'production', 'waste')),
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'RESUBMITTED')),
    acted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    comment TEXT,
    acted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS energy_baselines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    mean_kwh REAL NOT NULL,
    std_dev_kwh REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(machine_id, shift)
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('ENERGY', 'HYGIENE', 'WASTE')),
    source_record_type TEXT NOT NULL CHECK(source_record_type IN ('energy', 'hygiene', 'production', 'waste')),
    source_record_id INTEGER NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED')),
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evidence_json TEXT,
    recommended_action TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    ip_address TEXT,
    acted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_energy_status_date ON energy_records(status, record_date);
CREATE INDEX IF NOT EXISTS idx_energy_machine ON energy_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_energy_entered_by ON energy_records(entered_by);
CREATE INDEX IF NOT EXISTS idx_hygiene_status_date ON hygiene_records(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_hygiene_area ON hygiene_records(area_id);
CREATE INDEX IF NOT EXISTS idx_production_status_date ON production_records(status, production_date);
CREATE INDEX IF NOT EXISTS idx_waste_status_date ON waste_records(status, record_date);
CREATE INDEX IF NOT EXISTS idx_approval_history_record ON approval_history(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
