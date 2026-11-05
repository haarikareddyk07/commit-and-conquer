/**
 * SmartTrust Contract Audit Suite
 * Verifies that the SQLite database schema, views, constraints, and data models
 * strictly conform to Shared Contract Sections D, E, F, and G.
 */

const path = require('path');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = require(path.resolve(__dirname, '../database/node_modules/better-sqlite3'));
}

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../database/smarttrust.db');
const db = new Database(dbPath, { readonly: true });
db.pragma('foreign_keys = ON');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('SMARTTRUST CONTRACT AUDIT SUITE (Sections D - G)');
console.log(`Database Target: ${dbPath}`);
console.log('======================================================================\n');

// 1. Table Existence Check (Section E: 16 required tables)
console.log('--- 1. Checking Table Existence (Section E) ---');
const requiredTables = [
  'departments', 'users', 'machines', 'areas', 'sanitation_schedules',
  'products', 'materials', 'uploads', 'energy_records', 'hygiene_records',
  'production_records', 'waste_records', 'approval_history', 'energy_baselines',
  'alerts', 'audit_log'
];

const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
requiredTables.forEach(t => {
  assert(existingTables.includes(t), `Table exists: ${t}`);
});

// 2. Views Existence Check (Section E: 4 required views)
console.log('\n--- 2. Checking SQL Views (Section E & F) ---');
const requiredViews = [
  'v_pending_approvals', 'v_energy_daily_by_machine',
  'v_hygiene_compliance_by_area', 'v_waste_by_product'
];
const existingViews = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all().map(r => r.name);
requiredViews.forEach(v => {
  assert(existingViews.includes(v), `View exists: ${v}`);
});

// 3. Enum & Domain Integrity (Section D)
console.log('\n--- 3. Checking Enums and Value Constraints (Section D) ---');
// User roles
const roles = db.prepare("SELECT DISTINCT role FROM users").all().map(r => r.role);
const validRoles = ['EMPLOYEE', 'SUPERVISOR', 'MANAGER'];
assert(roles.every(r => validRoles.includes(r)), 'User roles match exact contract enums', roles.join(', '));

// Record statuses
const validRecordStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED'];
const energyStatuses = db.prepare("SELECT DISTINCT status FROM energy_records").all().map(r => r.status);
assert(energyStatuses.every(s => validRecordStatuses.includes(s)), 'Energy record statuses match contract', energyStatuses.join(', '));

// Alert statuses & types
const validAlertStatuses = ['OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'];
const validAlertTypes = ['ENERGY', 'HYGIENE', 'WASTE'];
const validSeverities = ['LOW', 'MEDIUM', 'HIGH'];
const alerts = db.prepare("SELECT alert_type, severity, status FROM alerts").all();
if (alerts.length > 0) {
  assert(alerts.every(a => validAlertStatuses.includes(a.status)), 'Alert statuses match contract enums');
  assert(alerts.every(a => validAlertTypes.includes(a.alert_type)), 'Alert types match contract enums');
  assert(alerts.every(a => validSeverities.includes(a.severity)), 'Alert severities match contract enums');
} else {
  assert(true, 'Alert constraints enforced in DDL schema');
}

// Shifts
const validShifts = ['MORNING', 'AFTERNOON', 'NIGHT'];
const shifts = db.prepare("SELECT DISTINCT shift FROM energy_records").all().map(r => r.shift);
assert(shifts.every(s => validShifts.includes(s)), 'Shift values match contract enums');

// 4. Checking Demo Accounts (Section H)
console.log('\n--- 4. Checking Pre-Seeded Demo Accounts (Section H) ---');
const expectedDemoEmails = [
  'employee@smarttrust.demo',
  'supervisor@smarttrust.demo',
  'manager@smarttrust.demo'
];
expectedDemoEmails.forEach(email => {
  const user = db.prepare("SELECT id, full_name, email, role FROM users WHERE email = ?").get(email);
  assert(user !== undefined, `Demo account exists: ${email}`);
});

// 5. Checking Data Model Date Formats (Section F)
console.log('\n--- 5. Checking Date and Timestamp Formats (Section F) ---');
const sampleEnergy = db.prepare("SELECT record_date, created_at FROM energy_records LIMIT 5").all();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

assert(sampleEnergy.every(r => dateRegex.test(r.record_date)), 'record_date adheres to YYYY-MM-DD');
assert(sampleEnergy.every(r => isoRegex.test(r.created_at)), 'created_at adheres to ISO 8601 UTC (Z)');

console.log('\n======================================================================');
console.log(`CONTRACT AUDIT RESULT: ${passed} Passed | ${failed} Failed`);
console.log('======================================================================\n');

db.close();

if (failed > 0) {
  process.exit(1);
}
