-- Migration 003: Useful SQL Views
-- Creates:
--  1. v_pending_approvals: unified pending & correction requested queue across energy, hygiene, production, and waste
--  2. v_energy_daily_by_machine: daily energy consumption and load metrics by machine for approved records
--  3. v_hygiene_compliance_by_area: hygiene compliance percentage and task breakdown by area
--  4. v_waste_by_product: production loss and logged waste comparison against expected loss standards

-- ----------------------------------------------------------------------------
-- View 1: v_pending_approvals
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
-- View 2: v_energy_daily_by_machine
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
-- View 3: v_hygiene_compliance_by_area
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
-- View 4: v_waste_by_product
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
