/**
 * SmartTrust - Database Migration Runner
 * Applies numbered SQL migrations from database/migrations/ once and tracks them in schema_migrations.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function migrate(customDbPath) {
  const dbPath = customDbPath || process.env.DB_PATH || path.join(__dirname, 'smarttrust.db');
  console.log(`[Migrate] Running migrations on database: ${dbPath}`);

  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[Migrate] Migrations directory not found at: ${migrationsDir}`);
    db.close();
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;

  for (const file of files) {
    const versionMatch = file.match(/^(\d+)/);
    const version = versionMatch ? versionMatch[1] : file;

    if (appliedVersions.has(version)) {
      console.log(`[Migrate] Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`[Migrate] Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `).run(version, file);
    });

    try {
      applyMigration();
      console.log(`[Migrate] Successfully applied: ${file}`);
      appliedCount++;
    } catch (err) {
      console.error(`[Migrate] Error applying migration ${file}:`, err.message);
      db.close();
      throw err;
    }
  }

  console.log(`[Migrate] Done. Applied ${appliedCount} migration(s).`);
  db.close();
  return appliedCount;
}

if (require.main === module) {
  try {
    migrate();
  } catch (err) {
    console.error('[Migrate] Migration failed:', err);
    process.exit(1);
  }
}

module.exports = { migrate };
