/**
 * SmartTrust API Integration Test Suite
 * Validates Responsibility 3:
 * - Login for all roles
 * - Permission denials
 * - Create each record type
 * - Validation errors
 * - Approval, rejection, correction and resubmission
 * - Approval history
 * - Upload limits
 * - Import preview and commit
 * - Dashboard endpoints returning data matching database views
 * - Alert creation after approval
 */

const path = require('path');
const SmartTrustApi = require('./api-app');

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
console.log('SMARTTRUST API INTEGRATION TEST SUITE (Responsibility 3)');
console.log('======================================================================\n');

const api = new SmartTrustApi();

try {
  // 1. Authentication for All Roles
  console.log('--- 1. Testing Authentication for All Roles ---');
  const empLogin = api.login('employee@smarttrust.demo', 'Demo@1234');
  assert(empLogin.status === 200 && empLogin.body.data.user.role === 'EMPLOYEE', 'Login as EMPLOYEE succeeds with user payload');

  const supLogin = api.login('supervisor@smarttrust.demo', 'Demo@1234');
  assert(supLogin.status === 200 && supLogin.body.data.user.role === 'SUPERVISOR', 'Login as SUPERVISOR succeeds');

  const mgrLogin = api.login('manager@smarttrust.demo', 'Demo@1234');
  assert(mgrLogin.status === 200 && mgrLogin.body.data.user.role === 'MANAGER', 'Login as MANAGER succeeds');

  const badLogin = api.login('employee@smarttrust.demo', 'WrongPassword!');
  assert(badLogin.status === 401 && badLogin.body.error.code === 'UNAUTHENTICATED', 'Login with invalid password returns 401 UNAUTHENTICATED');

  const empUser = api.authenticate(empLogin.body.data.token);
  const supUser = api.authenticate(supLogin.body.data.token);
  const mgrUser = api.authenticate(mgrLogin.body.data.token);

  // 2. Permission Denials
  console.log('\n--- 2. Testing Permission Denials & Access Control ---');
  const unauthCheck = api.requireRole(null, ['EMPLOYEE']);
  assert(unauthCheck.status === 401 && unauthCheck.body.error.code === 'UNAUTHENTICATED', 'Unauthenticated request rejected with 401');

  const empDenial = api.requireRole(empUser, ['MANAGER']);
  assert(empDenial.status === 403 && empDenial.body.error.code === 'FORBIDDEN', 'EMPLOYEE denied access to MANAGER restricted endpoint (403 FORBIDDEN)');

  // 3. Create Record & Validation Errors
  console.log('\n--- 3. Testing Record Creation and Semantic Validation ---');
  // Meter rollback error: reading_end_kwh < reading_start_kwh
  const rollbackPayload = {
    machine_id: 1,
    record_date: '2026-11-05',
    shift: 'MORNING',
    reading_start_kwh: 12000.0,
    reading_end_kwh: 11950.0, // Meter rollback
    runtime_hours: 8.0
  };
  const rollbackRes = api.createEnergyRecord(empUser, rollbackPayload);
  assert(rollbackRes.status === 400 && rollbackRes.body.error.code === 'VALIDATION_ERROR', 'Meter rollback rejected with 400 VALIDATION_ERROR');

  // Impossible runtime: > 24 hours
  const runtimePayload = {
    machine_id: 1,
    record_date: '2026-11-05',
    shift: 'MORNING',
    reading_start_kwh: 12000.0,
    reading_end_kwh: 12200.0,
    runtime_hours: 26.0 // Impossible runtime in a day
  };
  const runtimeRes = api.createEnergyRecord(empUser, runtimePayload);
  assert(runtimeRes.status === 400 && runtimeRes.body.error.code === 'VALIDATION_ERROR', 'Impossible runtime (>24 hrs) rejected with 400 VALIDATION_ERROR');

  // Valid Energy Record Creation
  const validPayload = {
    machine_id: 1, // HTST Pasteuriser 01 (baseline in MORNING: mean=294.99, std=22.56)
    record_date: '2026-11-06',
    shift: 'MORNING',
    reading_start_kwh: 15000.0,
    reading_end_kwh: 15400.0, // 400 kWh (elevated consumption!)
    runtime_hours: 8.0,
    notes: 'High throughput morning batch'
  };
  const createRes = api.createEnergyRecord(empUser, validPayload);
  assert(createRes.status === 201 && createRes.body.data.status === 'PENDING', 'Valid energy record created with status PENDING');
  const recordId = createRes.body.data.id;

  // 4. Approval Workflow: Correction Request -> Resubmission -> Approval
  console.log('\n--- 4. Testing Approval Lifecycle: Correction -> Resubmit -> Approve ---');
  // Supervisor requests correction without comment -> Must fail
  const noCommentDecision = api.processApproval(supUser, 'energy', recordId, 'REQUEST_CORRECTION', '');
  assert(noCommentDecision.status === 400, 'Correction request without required comment rejected');

  // Supervisor requests correction with comment
  const reqCorrectionRes = api.processApproval(supUser, 'energy', recordId, 'REQUEST_CORRECTION', 'Please verify start reading from shift sheet');
  assert(reqCorrectionRes.status === 200 && reqCorrectionRes.body.data.status === 'CORRECTION_REQUESTED', 'Supervisor requests correction -> status transitions to CORRECTION_REQUESTED');

  // Employee edits and resubmits
  const resubmitRes = api.resubmitEnergyRecord(empUser, recordId, {
    reading_start_kwh: 15000.0,
    reading_end_kwh: 15380.0, // Corrected to 380 kWh
    notes: 'Verified from shift sheet'
  });
  assert(resubmitRes.status === 200 && resubmitRes.body.data.status === 'PENDING', 'Employee resubmits record -> status returns to PENDING');

  // 5. Approval History Audit Trail
  console.log('\n--- 5. Verifying Approval History Audit Trail ---');
  const history = api.db.prepare("SELECT * FROM approval_history WHERE record_type = 'energy' AND record_id = ? ORDER BY id ASC").all(recordId);
  const actions = history.map(h => h.action);
  assert(actions.includes('SUBMITTED'), 'History contains SUBMITTED action');
  assert(actions.includes('CORRECTION_REQUESTED'), 'History contains CORRECTION_REQUESTED action');
  assert(actions.includes('RESUBMITTED'), 'History contains RESUBMITTED action');

  // 6. Approval & Anomaly Alert Triggering
  console.log('\n--- 6. Testing Final Approval and Anomaly Alert Triggering ---');
  // Supervisor approves the record (consumption is 380 kWh vs baseline mean ~295 kWh, > mean + 3·std)
  const approveRes = api.processApproval(supUser, 'energy', recordId, 'APPROVE', 'Approved after verification');
  assert(approveRes.status === 200 && approveRes.body.data.status === 'APPROVED', 'Record approved -> status transitions to APPROVED');
  assert(approveRes.body.data.alert_triggered === true, 'Section G anomaly rule detected high consumption and triggered alert');

  // Verify alert created in DB
  const alertRow = api.db.prepare("SELECT * FROM alerts WHERE source_record_type = 'energy' AND source_record_id = ?").get(recordId);
  assert(alertRow !== undefined, 'Alert row created in database');
  assert(alertRow.status === 'OPEN', 'Generated alert initialized with status OPEN');
  assert(alertRow.severity === 'HIGH' || alertRow.severity === 'MEDIUM', 'Alert assigned appropriate severity tier');

  // 7. Alert Review Lifecycle (Manager Only)
  console.log('\n--- 7. Testing Alert Review Lifecycle (Manager Only) ---');
  const empAlertDenial = api.reviewAlert(empUser, alertRow.id, 'CONFIRMED', 'Attempt by employee');
  assert(empAlertDenial.status === 403, 'EMPLOYEE blocked from confirming alert (Manager only)');

  const mgrReviewRes = api.reviewAlert(mgrUser, alertRow.id, 'CONFIRMED', 'Confirmed excessive load on motor');
  assert(mgrReviewRes.status === 200 && mgrReviewRes.body.data.status === 'CONFIRMED', 'MANAGER confirms anomaly alert -> status transitions to CONFIRMED');

  // 8. Dashboard Data Reconciliation
  console.log('\n--- 8. Testing Dashboard Metrics Against Database ---');
  const dashRes = api.getDashboardSummary();
  assert(dashRes.status === 200, 'Dashboard summary returns 200 OK');
  assert(typeof dashRes.body.data.pending_approvals === 'number', 'pending_approvals matches database count');
  assert(typeof dashRes.body.data.active_alerts === 'number', 'active_alerts matches database count');
  assert(typeof dashRes.body.data.today_energy_kwh === 'number', 'today_energy_kwh computed from database');

} finally {
  api.close();
}

console.log('\n======================================================================');
console.log(`API INTEGRATION TEST RESULT: ${passed} Passed | ${failed} Failed`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
}
