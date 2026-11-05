/**
 * SmartTrust Security & Privacy Verification Suite
 * Validates Responsibility 5:
 * - Passwords never returned to clients
 * - SQL Injection resilience
 * - XSS attempt handling
 * - Authentication required for sensitive files & uploads
 * - No committed secrets and .env.example completeness
 */

const fs = require('fs');
const path = require('path');
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
console.log('SMARTTRUST SECURITY & PRIVACY AUDIT SUITE (Responsibility 5)');
console.log('======================================================================\n');

const api = new SmartTrustApi();

try {
  // 1. Password Privacy: Passwords Never Returned in Responses
  console.log('--- 1. Testing Password Privacy ---');
  const loginRes = api.login('employee@smarttrust.demo', 'Demo@1234');
  assert(loginRes.status === 200, 'Employee login successful');
  assert(loginRes.body.data.user.password === undefined, 'Plain password is not present in response');
  assert(loginRes.body.data.user.password_hash === undefined, 'password_hash is stripped from user object');

  // Verify bcrypt hash strength in DB
  const user = api.db.prepare("SELECT password_hash FROM users WHERE email = ?").get('employee@smarttrust.demo');
  assert(user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$'), 'Passwords salt-hashed using secure bcrypt format ($2b$/$2a$)');

  // 2. SQL Injection Resilience
  console.log('\n--- 2. Testing SQL Injection Resilience ---');
  // Attempt 1: Auth bypass via SQL injection in email
  const sqlInjLogin = api.login("' OR '1'='1", "any_password");
  assert(sqlInjLogin.status === 401, "SQL Injection in login (' OR '1'='1) safely rejected without bypass");

  // Attempt 2: SQL Injection in notes field
  const empUser = api.authenticate(loginRes.body.data.token);
  const sqlInjPayload = {
    machine_id: 2,
    record_date: '2026-11-06',
    shift: 'MORNING',
    reading_start_kwh: 5000.0,
    reading_end_kwh: 5180.0,
    runtime_hours: 6.0,
    notes: "'; DROP TABLE users; --"
  };
  const createSqlInjRes = api.createEnergyRecord(empUser, sqlInjPayload);
  assert(createSqlInjRes.status === 201, 'Input containing SQL injection string treated as literal text');

  // Verify users table still exists and intact
  const usersCount = api.db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  assert(usersCount >= 3, 'Users table completely intact (parameterized query executed safely)');

  // 3. XSS Sanitization & Handling
  console.log('\n--- 3. Testing XSS Handling in Comments & Notes ---');
  const xssString = "<script>alert('XSS-EXPLOIT')</script><img src=x onerror=alert(1)>";
  const supLogin = api.login('supervisor@smarttrust.demo', 'Demo@1234');
  const supUser = api.authenticate(supLogin.body.data.token);

  const xssReviewRes = api.processApproval(supUser, 'energy', createSqlInjRes.body.data.id, 'APPROVE', xssString);
  assert(xssReviewRes.status === 200, 'Review comment with HTML tags handled without server crash');

  const record = api.db.prepare("SELECT review_comment FROM energy_records WHERE id = ?").get(createSqlInjRes.body.data.id);
  assert(record.review_comment === xssString, 'Payload preserved safely as literal string data in database');

  // 4. File & Endpoint Privacy: Anonymous Access Blocked
  console.log('\n--- 4. Testing Anonymous Access Blocking ---');
  const anonCheck = api.requireRole(null, ['EMPLOYEE', 'SUPERVISOR', 'MANAGER']);
  assert(anonCheck.status === 401 && anonCheck.body.error.code === 'UNAUTHENTICATED', 'Anonymous access to operational data blocked with 401');

  // 5. Environment & Secrets Hygiene Check
  console.log('\n--- 5. Checking Secret Hygiene & .env.example ---');
  const envExamplePath = path.resolve(__dirname, '../../.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example file exists at repository root');

  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  const requiredEnvVars = ['PORT', 'JWT_SECRET', 'DB_PATH', 'UPLOAD_DIR', 'CORS_ORIGIN'];
  requiredEnvVars.forEach(v => {
    assert(envContent.includes(v + '='), `.env.example documents required variable: ${v}`);
  });

  // Verify that live .env is git-ignored
  const gitignorePath = path.resolve(__dirname, '../../.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  assert(gitignoreContent.includes('.env'), '.gitignore properly excludes .env files from git tracking');

} finally {
  api.close();
}

console.log('\n======================================================================');
console.log(`SECURITY & PRIVACY RESULT: ${passed} Passed | ${failed} Failed`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
}
