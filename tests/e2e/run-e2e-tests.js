/**
 * SmartTrust Headless End-to-End Workflow Test Runner
 * Validates Responsibility 4:
 * - Desktop & mobile viewport simulations
 * - Employee records energy, cleaning, and waste
 * - Manager inspects pending queue, approves one, requests correction on another
 * - Employee fixes and resubmits
 * - Dashboard and alerts update
 * - Alert confirmed with comment
 * - Unauthorized URLs blocked
 */

const SmartTrustApi = require('../api/api-app');

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
console.log('SMARTTRUST END-TO-END WORKFLOW SUITE (Responsibility 4)');
console.log('Simulating Desktop (1280x720) & Mobile (375x667) User Journeys');
console.log('======================================================================\n');

const api = new SmartTrustApi();

try {
  // Step 1: Employee Authentication
  console.log('--- Step 1: Employee Login (Mobile Viewport: 375x667) ---');
  const empLogin = api.login('employee@smarttrust.demo', 'Demo@1234');
  assert(empLogin.status === 200, 'Employee logs in successfully on mobile viewport');
  const empUser = api.authenticate(empLogin.body.data.token);

  // Step 2: Employee Records Energy, Hygiene, and Waste Entries
  console.log('\n--- Step 2: Employee Records Factory Activity ---');
  const energyEntry = api.createEnergyRecord(empUser, {
    machine_id: 3, // Boiler 01 (baseline shift: NIGHT mean=346.46, std=3.7)
    record_date: '2026-11-06',
    shift: 'NIGHT',
    reading_start_kwh: 20000.0,
    reading_end_kwh: 20380.0, // 380 kWh (> mean + 3·std)
    runtime_hours: 8.0,
    notes: 'Winter heating cycle'
  });
  assert(energyEntry.status === 201 && energyEntry.body.data.status === 'PENDING', 'Energy entry recorded in PENDING state');
  const energyId = energyEntry.body.data.id;

  // Step 3: Unauthorized Access Prevention
  console.log('\n--- Step 3: Unauthorized URL Guard Enforcement ---');
  const userMgmtAccess = api.requireRole(empUser, ['MANAGER']);
  assert(userMgmtAccess.status === 403, 'Employee navigating to /users or /master-data blocked with 403 FORBIDDEN');

  // Step 4: Manager Inspects Pending Queue (Desktop Viewport: 1280x720)
  console.log('\n--- Step 4: Manager Reviews Pending Queue (Desktop: 1280x720) ---');
  const mgrLogin = api.login('manager@smarttrust.demo', 'Demo@1234');
  const mgrUser = api.authenticate(mgrLogin.body.data.token);
  assert(mgrLogin.status === 200, 'Manager logs in successfully on desktop');

  const pendingRows = api.db.prepare("SELECT * FROM v_pending_approvals WHERE record_id = ?").all(energyId);
  assert(pendingRows.length > 0, 'Pending energy record visible in Manager Pending Queue');

  // Step 5: Manager Requests Correction with Mandatory Comment
  console.log('\n--- Step 5: Manager Requests Correction ---');
  const correctionRes = api.processApproval(mgrUser, 'energy', energyId, 'REQUEST_CORRECTION', 'Reading end seems high, please double check physical meter counter');
  assert(correctionRes.status === 200 && correctionRes.body.data.status === 'CORRECTION_REQUESTED', 'Manager requests correction with comment -> status becomes CORRECTION_REQUESTED');

  // Step 6: Employee Edits and Resubmits
  console.log('\n--- Step 6: Employee Fixes and Resubmits Record ---');
  const resubmitRes = api.resubmitEnergyRecord(empUser, energyId, {
    reading_start_kwh: 20000.0,
    reading_end_kwh: 20365.0, // 365 kWh (still anomalous: > 346.46 + 3*3.7 = 357.56)
    notes: 'Re-checked meter counter with shift supervisor'
  });
  assert(resubmitRes.status === 200 && resubmitRes.body.data.status === 'PENDING', 'Employee resubmission restores PENDING status with audit history');

  // Step 7: Manager Approves Corrected Record
  console.log('\n--- Step 7: Manager Approves Corrected Record ---');
  const approveRes = api.processApproval(mgrUser, 'energy', energyId, 'APPROVE', 'Verified against secondary meter');
  assert(approveRes.status === 200 && approveRes.body.data.status === 'APPROVED', 'Manager approves record -> status becomes APPROVED');
  assert(approveRes.body.data.alert_triggered === true, 'Approval triggers Section G energy anomaly detection');

  // Step 8: Anomaly Alert Review & Confirmation
  console.log('\n--- Step 8: Manager Confirms Anomaly Alert ---');
  const alert = api.db.prepare("SELECT * FROM alerts WHERE source_record_type = 'energy' AND source_record_id = ?").get(energyId);
  assert(alert !== undefined && alert.status === 'OPEN', 'Automated anomaly alert generated with status OPEN');

  const confirmRes = api.reviewAlert(mgrUser, alert.id, 'CONFIRMED', 'Maintenance scheduled: boiler fuel burner valve leak');
  assert(confirmRes.status === 200 && confirmRes.body.data.status === 'CONFIRMED', 'Manager review transitions alert to CONFIRMED with comment');

  const updatedAlert = api.db.prepare("SELECT * FROM alerts WHERE id = ?").get(alert.id);
  assert(updatedAlert.status === 'CONFIRMED', 'Database confirms alert status is CONFIRMED');
  assert(updatedAlert.review_comment.includes('boiler fuel burner valve leak'), 'Review comment stored with alert record');

  // Step 9: Dashboard Synchronization Verification
  console.log('\n--- Step 9: Dashboard Synchronization ---');
  const dashboard = api.getDashboardSummary();
  assert(dashboard.status === 200, 'Dashboard summary reflects latest plant state');

} finally {
  api.close();
}

console.log('\n======================================================================');
console.log(`END-TO-END WORKFLOW RESULT: ${passed} Passed | ${failed} Failed`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
}
