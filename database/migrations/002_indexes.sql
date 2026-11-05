-- Migration 002: Indexes for query optimization
-- Creates indexes for status, date, user, machine, area, alert severity, and approval history queries.

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

-- Records by machine / area / schedule
CREATE INDEX IF NOT EXISTS idx_energy_records_machine ON energy_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_area ON hygiene_records(area_id);
CREATE INDEX IF NOT EXISTS idx_hygiene_records_schedule ON hygiene_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_records_product ON production_records(product_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_material ON waste_records(material_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_production ON waste_records(production_record_id);

-- Alerts by status, severity, and source record
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type_status ON alerts(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source_record_type, source_record_id);

-- Approval history by record and acted_by
CREATE INDEX IF NOT EXISTS idx_approval_history_record ON approval_history(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_acted_by ON approval_history(acted_by);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_acted_at ON audit_log(user_id, acted_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
