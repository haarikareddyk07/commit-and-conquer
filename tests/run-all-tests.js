/**
 * SmartTrust Unified Master Test Runner
 * Executes all integration, database, contract, security, and E2E test suites in sequence.
 * Ensures tests run on an isolated copy of the database to guarantee determinism and idempotency.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const originalDb = path.resolve(rootDir, 'database/smarttrust.db');
const testDb = path.resolve(rootDir, 'database/smarttrust.test.db');

console.log('======================================================================');
console.log('🚀 SMARTTRUST UNIFIED INTEGRATION & QUALITY ASSURANCE TEST SUITE');
console.log(`Repository Root: ${rootDir}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('======================================================================\n');

// Verify original database exists
if (!fs.existsSync(originalDb)) {
  console.error(`❌ Master database not found at ${originalDb}. Run 'npm run db:setup' first.`);
  process.exit(1);
}

// Create isolated test database copy
console.log(`📦 Creating test database copy: ${path.basename(testDb)}...`);
fs.copyFileSync(originalDb, testDb);

const suites = [
  {
    name: 'Contract Audit (Sections D-G)',
    script: 'tests/contract-audit.js',
    env: { DB_PATH: testDb }
  },
  {
    name: 'Database Constraints & Foreign Keys',
    script: 'database/test-constraints.js',
    env: { DB_PATH: testDb }
  },
  {
    name: 'Database Schema & Seed Verification',
    script: 'database/verify-database.js',
    env: { DB_PATH: testDb }
  },
  {
    name: 'API Integration Test Suite',
    script: 'tests/api/run-api-tests.js',
    env: { DB_PATH: testDb }
  },
  {
    name: 'Security & Privacy Audit Suite',
    script: 'tests/security/run-security-tests.js',
    env: { DB_PATH: testDb }
  },
  {
    name: 'Headless E2E User Journey Suite',
    script: 'tests/e2e/run-e2e-tests.js',
    env: { DB_PATH: testDb }
  }
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

const startTime = Date.now();

for (const suite of suites) {
  console.log(`\n======================================================================`);
  console.log(`▶ Running Suite: ${suite.name}`);
  console.log(`Script: ${suite.script}`);
  console.log(`======================================================================\n`);

  const env = Object.assign({}, process.env, suite.env);
  const proc = spawnSync(process.execPath, [path.resolve(rootDir, suite.script)], {
    cwd: rootDir,
    env,
    stdio: 'inherit'
  });

  if (proc.status === 0) {
    totalPassed++;
    results.push({ name: suite.name, status: 'PASSED' });
  } else {
    totalFailed++;
    results.push({ name: suite.name, status: 'FAILED' });
  }
}

// Cleanup test database and any journal files
try {
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  const walFile = `${testDb}-wal`;
  const shmFile = `${testDb}-shm`;
  if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
  if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
} catch (e) {
  // Non-fatal cleanup warning
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n======================================================================');
console.log('🏁 MASTER TEST EXECUTION SUMMARY');
console.log('======================================================================');
results.forEach(r => {
  const icon = r.status === 'PASSED' ? '✅' : '❌';
  console.log(`  ${icon} [${r.status}] ${r.name}`);
});
console.log('----------------------------------------------------------------------');
console.log(`Total Suites: ${suites.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
console.log(`Duration: ${duration}s`);
console.log('======================================================================\n');

if (totalFailed > 0) {
  console.error(`💥 Verification completed with ${totalFailed} failing test suite(s).`);
  process.exit(1);
} else {
  console.log('🎉 All integration, database, contract, and security test suites PASSED!');
  process.exit(0);
}
