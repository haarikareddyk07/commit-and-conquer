const path = require('path');
const fs = require('fs');
const config = require('./env');

class DatabaseAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      const BetterSqlite3 = require('better-sqlite3');
      this.db = new BetterSqlite3(dbPath);
      this.isBetterSqlite = true;
    } catch (e) {
      // Fallback to Node.js 22 built-in node:sqlite
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(dbPath);
      this.isBetterSqlite = false;
    }

    this.pragma('foreign_keys = ON');
    this.pragma('journal_mode = WAL');
    this.pragma('busy_timeout = 5000');
  }

  pragma(pragmaStr) {
    if (this.isBetterSqlite) {
      return this.db.pragma(pragmaStr);
    }
    return this.db.exec(`PRAGMA ${pragmaStr};`);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  prepare(sql) {
    if (this.isBetterSqlite) {
      return this.db.prepare(sql);
    }

    const stmt = this.db.prepare(sql);
    return {
      run: (...params) => {
        // Flatten params if passed as an array or object
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const result = stmt.run(...args);
        return {
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid)
        };
      },
      get: (...params) => {
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const row = stmt.get(...args);
        return row || null;
      },
      all: (...params) => {
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.all(...args);
      }
    };
  }

  transaction(fn) {
    if (this.isBetterSqlite) {
      return this.db.transaction(fn);
    }

    return (...args) => {
      this.db.exec('BEGIN');
      try {
        const res = fn(...args);
        this.db.exec('COMMIT');
        return res;
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    };
  }

  close() {
    return this.db.close();
  }
}

let dbInstance = null;

function getDatabase(customPath) {
  if (customPath) {
    return new DatabaseAdapter(customPath);
  }
  if (!dbInstance) {
    const resolvedPath = path.isAbsolute(config.dbPath)
      ? config.dbPath
      : path.resolve(__dirname, '../../', config.dbPath);
    dbInstance = new DatabaseAdapter(resolvedPath);
  }
  return dbInstance;
}

module.exports = {
  getDatabase,
  DatabaseAdapter
};
