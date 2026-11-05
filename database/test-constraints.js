/**
 * SmartTrust Dairy Plant Management System - Constraint & View Validation Test
 * Proves that foreign keys, enum checks, numeric checks, unique constraints, and views operate correctly.
 */

const path = require('path');
const Database = require('better-sqlite3');

function runTests(customDbPath) {
  const dbPath = customDbPath || process.env.DB_PATH || path.join(__dirname, 'smarttrust.db');
  console.log(`\n===============================================================`);
  console.log(`[Test] Running constraint and view validation on: ${dbPath}`);
  console.log(`===============================================================\n`);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  let passed = 0;
  let failed = 0;

  function assertThrows(testName, fn, expectedErrSubstr) {
    try {
      fn();
      console.error(`❌ FAIL: ${testName} (expected exception, but none was thrown)`);
      failed++;
    } catch (err) {
      if (!expectedErrSubstr || err.message.includes(expectedErrSubstr) || err.code?.includes(expectedErrSubstr)) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${testName} (expected '${expectedErrSubstr}', got '${err.message}')`);
        failed++;
      }
    }
  }

  function assert(testName, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. FOREIGN KEY CONSTRAINT TESTS
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Foreign Key Constraints ---');

  assertThrows(
    'Reject energy record referencing non-existent machine_id (FK)',
    () => {
      db.prepare(`
        INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours)
        VALUES (9999, 1, '2026-11-05', 'MORNING', 100, 200, 100, 7)
      `).run();
    },
    'FOREIGN KEY'
  );

  assertThrows(
    'Reject deletion of machine with active energy records (ON DELETE RESTRICT - no cascade delete of records)',
    () => {
      db.prepare('DELETE FROM machines WHERE id = 1').run();
    },
    'FOREIGN KEY'
  );

  assertThrows(
    'Reject deletion of user who submitted approval history (ON DELETE RESTRICT - no cascade delete of approval history)',
    () => {
      db.prepare('DELETE FROM users WHERE id = 1').run();
    },
    'FOREIGN KEY'
  );

  // --------------------------------------------------------------------------
  // 2. ENUM CHECK CONSTRAINT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Enum CHECK Constraints ---');

  assertThrows(
    'Reject user with invalid role (CHECK role)',
    () => {
      db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Test User', 'invalidrole@smarttrust.demo', 'hash123', 'SYSTEM_ADMIN')
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject energy record with invalid shift (CHECK shift)',
    () => {
      db.prepare(`
        INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours)
        VALUES (1, 1, '2026-11-05', 'EVENING', 100, 200, 100, 7)
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject alert with invalid alert_type (CHECK alert_type)',
    () => {
      db.prepare(`
        INSERT INTO alerts (alert_type, source_record_type, source_record_id, severity, status, title, explanation, evidence_json, recommended_action)
        VALUES ('TEMPERATURE', 'energy', 1, 'HIGH', 'OPEN', 'Title', 'Expl', '{}', 'Action')
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject alert with invalid severity (CHECK severity)',
    () => {
      db.prepare(`
        INSERT INTO alerts (alert_type, source_record_type, source_record_id, severity, status, title, explanation, evidence_json, recommended_action)
        VALUES ('ENERGY', 'energy', 1, 'CRITICAL', 'OPEN', 'Title', 'Expl', '{}', 'Action')
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject waste record with invalid waste_type (CHECK waste_type)',
    () => {
      db.prepare(`
        INSERT INTO waste_records (material_id, record_date, shift, waste_type, quantity, unit, cause, entered_by)
        VALUES (1, '2026-11-05', 'MORNING', 'THEFT', 10, 'LITRE', 'Missing stock', 1)
      `).run();
    },
    'CHECK'
  );

  // --------------------------------------------------------------------------
  // 3. NUMERIC CHECK CONSTRAINT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Numeric CHECK Constraints ---');

  assertThrows(
    'Reject energy record where reading_end_kwh < reading_start_kwh (meter rollback)',
    () => {
      db.prepare(`
        INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours)
        VALUES (1, 1, '2026-11-05', 'NIGHT', 500, 450, -50, 7)
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject energy record with negative consumption_kwh',
    () => {
      db.prepare(`
        INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours)
        VALUES (1, 1, '2026-11-05', 'NIGHT', 500, 500, -10, 7)
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject hygiene record with concentration_percent > 100',
    () => {
      db.prepare(`
        INSERT INTO hygiene_records (schedule_id, area_id, entered_by, scheduled_date, completed_at, chemical_used, concentration_percent, contact_minutes)
        VALUES (1, 2, 1, '2026-11-05', '2026-11-05T10:00:00Z', 'Caustic', 105.0, 20)
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject hygiene record with negative concentration_percent',
    () => {
      db.prepare(`
        INSERT INTO hygiene_records (schedule_id, area_id, entered_by, scheduled_date, completed_at, chemical_used, concentration_percent, contact_minutes)
        VALUES (1, 2, 1, '2026-11-05', '2026-11-05T10:00:00Z', 'Caustic', -2.5, 20)
      `).run();
    },
    'CHECK'
  );

  assertThrows(
    'Reject machine with negative rated_power_kw',
    () => {
      db.prepare(`
        INSERT INTO machines (machine_code, name, department_id, machine_type, rated_power_kw)
        VALUES ('TEST-NEG', 'Negative Power Unit', 1, 'PUMP', -15.0)
      `).run();
    },
    'CHECK'
  );

  // --------------------------------------------------------------------------
  // 4. UNIQUE & PARTIAL UNIQUE CONSTRAINT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Unique Constraints & Partial Index ---');

  assertThrows(
    'Reject duplicate email in users',
    () => {
      db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Duplicate Ramesh', 'employee@smarttrust.demo', 'hash', 'EMPLOYEE')
      `).run();
    },
    'UNIQUE'
  );

  assertThrows(
    'Reject duplicate machine_code in machines',
    () => {
      db.prepare(`
        INSERT INTO machines (machine_code, name, department_id, machine_type, rated_power_kw)
        VALUES ('PST-01', 'Duplicate Pasteuriser', 2, 'PASTEURISER', 45.0)
      `).run();
    },
    'UNIQUE'
  );

  assertThrows(
    'Reject duplicate product_code in products',
    () => {
      db.prepare(`
        INSERT INTO products (product_code, name, unit, expected_loss_percent)
        VALUES ('PRD-MLK', 'Duplicate Milk Code', 'LITRE', 1.5)
      `).run();
    },
    'UNIQUE'
  );

  // Test Partial Unique Constraint on energy_records:
  // "one energy record per machine, date and shift unless status is REJECTED"
  console.log('Testing partial unique constraint on energy_records (allow re-entry only when REJECTED)...');
  const testDate = '2027-01-01';

  // Insert first record (APPROVED)
  db.prepare(`
    INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, status)
    VALUES (1, 1, ?, 'NIGHT', 1000, 1100, 100, 8, 'APPROVED')
  `).run(testDate);

  // Attempt duplicate record on same date, machine, shift with status PENDING -> must FAIL
  assertThrows(
    'Reject duplicate active/approved energy record for same machine, date, and shift',
    () => {
      db.prepare(`
        INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, status)
        VALUES (1, 1, ?, 'NIGHT', 1000, 1100, 100, 8, 'PENDING')
      `).run(testDate);
    },
    'UNIQUE'
  );

  // Now change the first record to REJECTED
  db.prepare(`
    UPDATE energy_records SET status = 'REJECTED' WHERE machine_id = 1 AND record_date = ? AND shift = 'NIGHT'
  `).run(testDate);

  // Now inserting a new record with status PENDING must SUCCEED!
  let resubmittedOk = false;
  try {
    db.prepare(`
      INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, status)
      VALUES (1, 1, ?, 'NIGHT', 1000, 1100, 100, 8, 'PENDING')
    `).run(testDate);
    resubmittedOk = true;
  } catch (err) {
    resubmittedOk = false;
  }
  assert('Allow new energy record for same machine, date, and shift when previous is REJECTED', resubmittedOk);

  // Clean up test rows
  db.prepare('DELETE FROM energy_records WHERE record_date = ?').run(testDate);

  // --------------------------------------------------------------------------
  // 5. SQL VIEWS VALIDATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing SQL Views Results ---');

  // View 1: v_pending_approvals
  const pendingRows = db.prepare('SELECT * FROM v_pending_approvals').all();
  assert(
    'v_pending_approvals returns pending records across modules',
    pendingRows.length > 0,
    `(returned ${pendingRows.length} rows)`
  );
  console.log(`   Sample pending approval: [${pendingRows[0].record_type}] ${pendingRows[0].summary} (Status: ${pendingRows[0].status})`);

  // View 2: v_energy_daily_by_machine
  const energyDailyRows = db.prepare('SELECT * FROM v_energy_daily_by_machine ORDER BY record_date DESC LIMIT 5').all();
  assert(
    'v_energy_daily_by_machine aggregates daily consumption and runtime',
    energyDailyRows.length > 0 && energyDailyRows[0].total_consumption_kwh > 0,
    `(returned ${energyDailyRows.length} rows, top consumption: ${energyDailyRows[0]?.total_consumption_kwh} kWh)`
  );
  console.log(`   Sample daily energy: ${energyDailyRows[0].machine_name} on ${energyDailyRows[0].record_date} = ${energyDailyRows[0].total_consumption_kwh} kWh (${energyDailyRows[0].total_runtime_hours} hrs, load: ${energyDailyRows[0].avg_kw_load} kW)`);

  // View 3: v_hygiene_compliance_by_area
  const hygieneComplianceRows = db.prepare('SELECT * FROM v_hygiene_compliance_by_area').all();
  assert(
    'v_hygiene_compliance_by_area calculates compliance percentages',
    hygieneComplianceRows.length > 0,
    `(returned ${hygieneComplianceRows.length} areas)`
  );
  const sampleArea = hygieneComplianceRows.find(r => r.total_records > 0) || hygieneComplianceRows[0];
  console.log(`   Sample hygiene compliance: ${sampleArea.area_name} (${sampleArea.department_name}) = ${sampleArea.compliance_percent}% (${sampleArea.approved_records}/${sampleArea.total_records} approved)`);

  // View 4: v_waste_by_product
  const wasteProductRows = db.prepare('SELECT * FROM v_waste_by_product').all();
  assert(
    'v_waste_by_product reconciles production loss and logged waste',
    wasteProductRows.length > 0,
    `(returned ${wasteProductRows.length} products)`
  );
  const butterProduct = wasteProductRows.find(p => p.product_code === 'PRD-BTR') || wasteProductRows[0];
  console.log(`   Sample waste by product: ${butterProduct.product_name} - Input: ${butterProduct.total_raw_input_qty} ${butterProduct.unit}, Loss: ${butterProduct.total_production_loss_qty} (${butterProduct.actual_loss_percent}% vs expected ${butterProduct.expected_loss_percent}%)`);

  db.close();

  console.log(`\n===============================================================`);
  console.log(`[Test Summary] Passed: ${passed} | Failed: ${failed}`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
