/**
 * SmartTrust Dairy Plant Management System - Database Reset Script
 * Wipes the database, applies all migrations cleanly, and seeds deterministic demo data.
 */

const fs = require('fs');
const path = require('path');
const { migrate } = require('./migrate');
const { seed } = require('./seed');

function reset(customDbPath) {
  const dbPath = customDbPath || process.env.DB_PATH || path.join(__dirname, 'smarttrust.db');
  console.log(`[Reset] Resetting database at: ${dbPath}`);

  // Remove existing database files if they exist
  const filesToRemove = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const f of filesToRemove) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`[Reset] Removed old file: ${path.basename(f)}`);
      } catch (err) {
        console.warn(`[Reset] Warning: Could not remove ${f}: ${err.message}`);
      }
    }
  }

  // 1. Run Migrations
  console.log('[Reset] Step 1: Applying migrations...');
  migrate(dbPath);

  // 2. Run Seeder
  console.log('[Reset] Step 2: Seeding master & historical data...');
  seed(dbPath);

  console.log('[Reset] Database successfully reset and seeded!');
}

if (require.main === module) {
  try {
    reset();
  } catch (err) {
    console.error('[Reset] Reset failed:', err);
    process.exit(1);
  }
}

module.exports = { reset };
