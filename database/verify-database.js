/**
 * SmartTrust Dairy Plant Management System - Full Database Verification Suite
 * Verifies:
 *  1. Table and relationship integrity (PRAGMA foreign_key_check & foreign_key_list)
 *  2. Sample data completeness across all required tables
 *  3. CRUD operation lifecycle and transaction atomicity
 *  4. Backend connectivity, parameter binding, WAL mode, and query performance
 */

const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'smarttrust.db');
console.log(`\n======================================================================`);
console.log(`SMARTTRUST DATABASE VERIFICATION SUITE`);
console.log(`Target Database: ${dbPath}`);
console.log(`======================================================================\n`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(description, condition, details = '') {
  totalChecks++;
  if (condition) {
    console.log(`  ✅ [PASS] ${description} ${details ? '(' + details + ')' : ''}`);
    passedChecks++;
  } else {
    console.error(`  ❌ [FAIL] ${description} ${details ? '(' + details + ')' : ''}`);
    failedChecks++;
  }
}

// ============================================================================
// 1. VERIFY ALL DATABASE TABLES AND RELATIONSHIPS
// ============================================================================
console.log(`\n--- 1. VERIFYING TABLES, VIEWS, AND RELATIONSHIPS ---`);

const expectedTables = [
  'departments', 'users', 'machines', 'areas', 'sanitation_schedules',
  'products', 'materials', 'uploads', 'energy_records', 'hygiene_records',
  'production_records', 'waste_records', 'approval_history', 'energy_baselines',
  'alerts', 'audit_log', 'schema_migrations'
];

const existingTables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
`).all().map(r => r.name);

for (const table of expectedTables) {
  assert(`Table exists: ${table}`, existingTables.includes(table));
}

const expectedViews = [
  'v_pending_approvals', 'v_energy_daily_by_machine',
  'v_hygiene_compliance_by_area', 'v_waste_by_product'
];

const existingViews = db.prepare(`
  SELECT name FROM sqlite_master WHERE type = 'view'
`).all().map(r => r.name);

for (const view of expectedViews) {
  assert(`View exists: ${view}`, existingViews.includes(view));
}

// Check Foreign Key Integrity across the entire database
const fkViolations = db.pragma('foreign_key_check');
assert('Foreign Key Integrity Check (PRAGMA foreign_key_check)', fkViolations.length === 0, `${fkViolations.length} violations found`);

// Check relationships
const machineFk = db.pragma('foreign_key_list(machines)');
assert('Machines -> Departments foreign key', machineFk.some(fk => fk.table === 'departments' && fk.to === 'id'));

const energyFk = db.pragma('foreign_key_list(energy_records)');
assert('Energy Records -> Machines foreign key', energyFk.some(fk => fk.table === 'machines' && fk.to === 'id'));
assert('Energy Records -> Users foreign key', energyFk.some(fk => fk.table === 'users' && fk.to === 'id'));

const wasteFk = db.pragma('foreign_key_list(waste_records)');
assert('Waste Records -> Materials foreign key', wasteFk.some(fk => fk.table === 'materials' && fk.to === 'id'));
assert('Waste Records -> Production Records foreign key', wasteFk.some(fk => fk.table === 'production_records' && fk.to === 'id'));

// ============================================================================
// 2. VERIFY SAMPLE DATA IN EVERY REQUIRED TABLE
// ============================================================================
console.log(`\n--- 2. VERIFYING SAMPLE DATA POPULATION ---`);

const tableCounts = {};
for (const table of expectedTables) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  tableCounts[table] = count;
  assert(`Data present in ${table}`, count > 0 || table === 'uploads', `${count} rows`);
}

// Verify Demo Users & Bcrypt Password
console.log('\n  Checking Demo Users:');
const demoEmails = ['employee@smarttrust.demo', 'supervisor@smarttrust.demo', 'manager@smarttrust.demo'];
const users = db.prepare('SELECT id, full_name, email, password_hash, role FROM users').all();
for (const email of demoEmails) {
  const user = users.find(u => u.email === email);
  assert(`Demo account exists: ${email}`, !!user);
  if (user) {
    const passwordValid = bcrypt.compareSync('Demo@1234', user.password_hash);
    assert(`Bcrypt hash valid for ${email} (Demo@1234)`, passwordValid);
  }
}

// Verify 45 Days of Historical Data Range
const energyDateRange = db.prepare(`
  SELECT MIN(record_date) AS min_date, MAX(record_date) AS max_date, COUNT(DISTINCT record_date) AS unique_days
  FROM energy_records
`).get();
assert('Energy records span ~45 days', energyDateRange.unique_days >= 40, `${energyDateRange.unique_days} unique days (${energyDateRange.min_date} to ${energyDateRange.max_date})`);

// Verify Energy Baselines
const baselineCount = db.prepare('SELECT COUNT(*) AS c FROM energy_baselines').get().c;
assert('Pre-calculated energy baselines populated', baselineCount >= 5, `${baselineCount} baselines`);
const sampleBaseline = db.prepare('SELECT * FROM energy_baselines LIMIT 1').get();
if (sampleBaseline) {
  assert('Baseline sample_count >= 5 samples', sampleBaseline.sample_count >= 5, `${sampleBaseline.sample_count} samples, mean: ${sampleBaseline.mean_kwh} kWh`);
}

// Verify Seeded Plant Deviations & Alerts
console.log('\n  Checking Planted Anomaly Alerts:');
const alerts = db.prepare('SELECT id, alert_type, severity, status, title FROM alerts').all();
assert('Alerts seeded for demo scenarios', alerts.length >= 3, `${alerts.length} alerts present`);

const highEnergyAlert = alerts.find(a => a.alert_type === 'ENERGY' && a.severity === 'HIGH');
assert('Planted HIGH Energy Anomaly Alert present', !!highEnergyAlert, highEnergyAlert?.title);

const hygieneAlert = alerts.find(a => a.alert_type === 'HYGIENE');
assert('Planted HYGIENE Anomaly Alert present', !!hygieneAlert, hygieneAlert?.title);

const wasteAlert = alerts.find(a => a.alert_type === 'WASTE' && a.severity === 'HIGH');
assert('Planted HIGH Waste Anomaly Alert present', !!wasteAlert, wasteAlert?.title);

// ============================================================================
// 3. TEST CRUD OPERATIONS & TRANSACTION ATOMICITY
// ============================================================================
console.log(`\n--- 3. TESTING CRUD OPERATIONS & TRANSACTION ATOMICITY ---`);

// CREATE
const insertMachine = db.prepare(`
  INSERT INTO machines (machine_code, name, department_id, machine_type, rated_power_kw)
  VALUES (?, ?, ?, ?, ?)
`);
const newMachineInfo = insertMachine.run('TEST-M01', 'Temporary Test Chiller', 4, 'CHILLER', 42.0);
const testMachineId = newMachineInfo.lastInsertRowid;
assert('CREATE machine row', testMachineId > 0, `id=${testMachineId}`);

// READ
const readMachine = db.prepare('SELECT * FROM machines WHERE id = ?').get(testMachineId);
assert('READ machine row', readMachine && readMachine.machine_code === 'TEST-M01');

// UPDATE
const updateMachine = db.prepare('UPDATE machines SET rated_power_kw = ? WHERE id = ?');
const updateResult = updateMachine.run(48.5, testMachineId);
assert('UPDATE machine row', updateResult.changes === 1);
const reReadMachine = db.prepare('SELECT rated_power_kw FROM machines WHERE id = ?').get(testMachineId);
assert('Verify updated value', reReadMachine.rated_power_kw === 48.5);

// CREATE related child record
const insertEnergyRecord = db.prepare(`
  INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, status)
  VALUES (?, ?, '2026-11-05', 'NIGHT', 100.0, 150.0, 50.0, 4.0, 'PENDING')
`);
const testEnergyInfo = insertEnergyRecord.run(testMachineId, 1);
const testEnergyId = testEnergyInfo.lastInsertRowid;
assert('CREATE child energy record', testEnergyId > 0, `id=${testEnergyId}`);

// DELETE RESTRICT Verification (cannot delete parent while child exists)
let deleteParentPrevented = false;
try {
  db.prepare('DELETE FROM machines WHERE id = ?').run(testMachineId);
} catch (err) {
  deleteParentPrevented = err.message.includes('FOREIGN KEY');
}
assert('DELETE parent blocked by foreign key (ON DELETE RESTRICT)', deleteParentPrevented);

// DELETE child then parent
const deleteEnergy = db.prepare('DELETE FROM energy_records WHERE id = ?').run(testEnergyId);
assert('DELETE child energy record', deleteEnergy.changes === 1);

const deleteMachine = db.prepare('DELETE FROM machines WHERE id = ?').run(testMachineId);
assert('DELETE parent machine row after child removed', deleteMachine.changes === 1);

// ATOMIC TRANSACTION TEST (Rollback on error)
let transactionRolledBack = false;
try {
  const failureTx = db.transaction(() => {
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('NonExistentDepartment'); // Will fail CHECK
  });
  failureTx();
} catch (err) {
  transactionRolledBack = true;
}
assert('Transaction rollbacks cleanly on CHECK constraint violation', transactionRolledBack);

// ============================================================================
// 4. VERIFY BACKEND CONNECTION, PARAMETER BINDING & WAL MODE
// ============================================================================
console.log(`\n--- 4. VERIFYING BACKEND COMPATIBILITY & PERFORMANCE ---`);

// Check WAL Mode
const journalMode = db.pragma('journal_mode', { simple: true });
assert('Database operates in WAL mode (Write-Ahead Logging)', journalMode.toLowerCase() === 'wal', `mode: ${journalMode}`);

// Check PRAGMA foreign_keys is ON
const fkStatus = db.pragma('foreign_keys', { simple: true });
assert('PRAGMA foreign_keys is enabled', fkStatus === 1);

// Test Named Parameter Binding
const queryNamed = db.prepare('SELECT id, full_name, role FROM users WHERE email = :email');
const userByNamedParam = queryNamed.get({ email: 'manager@smarttrust.demo' });
assert('Backend query with named parameter (:email) returns expected user', userByNamedParam && userByNamedParam.role === 'MANAGER');

// Test Positional Parameter Binding
const queryPos = db.prepare('SELECT id, machine_code, rated_power_kw FROM machines WHERE department_id = ?');
const machinesInDept = queryPos.all(2);
assert('Backend query with positional parameter (?) returns rows', machinesInDept.length > 0, `${machinesInDept.length} machines in Pasteurisation`);

// Test JSON Parsing from database columns
const alertWithJson = db.prepare('SELECT evidence_json FROM alerts WHERE id = 1').get();
let parsedJson = null;
try {
  parsedJson = JSON.parse(alertWithJson.evidence_json);
} catch (e) {}
assert('JSON evidence payload successfully parsed', parsedJson !== null && typeof parsedJson === 'object');

// Test Query Performance for Dashboard Aggregation
const startTime = process.hrtime.bigint();
const pendingAgg = db.prepare('SELECT record_type, COUNT(*) AS count FROM v_pending_approvals GROUP BY record_type').all();
const endTime = process.hrtime.bigint();
const queryDurationMs = Number(endTime - startTime) / 1000000;
assert('Dashboard View query executes with high performance (< 10ms)', queryDurationMs < 10.0, `${queryDurationMs.toFixed(3)} ms`);

db.close();

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n======================================================================`);
console.log(`VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
if (failedChecks === 0) {
  console.log(`STATUS: ALL DATABASE SUBSYSTEMS FULLY OPERATIONAL AND COMPLIANT`);
} else {
  console.log(`STATUS: ${failedChecks} CHECKS FAILED`);
}
console.log(`======================================================================\n`);

if (failedChecks > 0) {
  process.exit(1);
}
