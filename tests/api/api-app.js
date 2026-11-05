/**
 * SmartTrust Reference API Engine / Test Harness
 * Implements the Section F API Contract & Section G Business Rules directly on better-sqlite3.
 * Used for rigorous API Integration testing and Contract verification.
 */

const path = require('path');
const http = require('http');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = require(path.resolve(__dirname, '../../database/node_modules/better-sqlite3'));
}

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require(path.resolve(__dirname, '../../database/node_modules/bcrypt'));
}

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../database/smarttrust.db');

class SmartTrustApi {
  constructor(databasePath = dbPath) {
    this.db = new Database(databasePath);
    this.db.pragma('foreign_keys = ON');
    this.jwtSecret = process.env.JWT_SECRET || 'smarttrust_test_secret';
  }

  // --- Auth & Session Simulation ---
  login(email, password) {
    const user = this.db.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(email);
    if (!user) {
      return { status: 401, body: { success: false, error: { code: "UNAUTHENTICATED", message: "Invalid email or password" } } };
    }
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return { status: 401, body: { success: false, error: { code: "UNAUTHENTICATED", message: "Invalid email or password" } } };
    }
    // Return simulated token and user
    const token = `mock-token-${user.id}-${user.role}`;
    const { password_hash, ...safeUser } = user;
    return {
      status: 200,
      body: {
        success: true,
        data: { token, user: safeUser }
      }
    };
  }

  authenticate(token) {
    if (!token || !token.startsWith('mock-token-')) return null;
    const parts = token.replace('mock-token-', '').split('-');
    const userId = parseInt(parts[0], 10);
    return this.db.prepare("SELECT id, full_name, email, role, department_id, is_active FROM users WHERE id = ?").get(userId);
  }

  // --- Permission Guard ---
  requireRole(user, allowedRoles) {
    if (!user) {
      return { status: 401, body: { success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required" } } };
    }
    if (!allowedRoles.includes(user.role)) {
      return { status: 403, body: { success: false, error: { code: "FORBIDDEN", message: "Insufficient role permissions" } } };
    }
    return null;
  }

  // --- Operational Records CRUD ---
  createEnergyRecord(user, payload) {
    const authCheck = this.requireRole(user, ['EMPLOYEE', 'SUPERVISOR', 'MANAGER']);
    if (authCheck) return authCheck;

    const { machine_id, record_date, shift, reading_start_kwh, reading_end_kwh, runtime_hours, notes } = payload;
    
    // Validation
    const errors = [];
    if (!machine_id) errors.push({ field: "machine_id", message: "machine_id is required" });
    if (!record_date) errors.push({ field: "record_date", message: "record_date is required" });
    if (!['MORNING', 'AFTERNOON', 'NIGHT'].includes(shift)) {
      errors.push({ field: "shift", message: "shift must be MORNING, AFTERNOON, or NIGHT" });
    }
    if (reading_end_kwh < reading_start_kwh) {
      errors.push({ field: "reading_end_kwh", message: "reading_end_kwh cannot be less than reading_start_kwh" });
    }
    if (runtime_hours < 0 || runtime_hours > 24) {
      errors.push({ field: "runtime_hours", message: "runtime_hours must be between 0 and 24" });
    }

    if (errors.length > 0) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: errors } } };
    }

    const consumption_kwh = Math.round((reading_end_kwh - reading_start_kwh) * 100) / 100;
    const stmt = this.db.prepare(`
      INSERT INTO energy_records (machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `);
    
    try {
      const info = stmt.run(machine_id, user.id, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, notes || null);
      
      // Log submission in approval_history
      this.db.prepare(`
        INSERT INTO approval_history (record_type, record_id, action, acted_by, comment)
        VALUES ('energy', ?, 'SUBMITTED', ?, 'Initial record submission')
      `).run(info.lastInsertRowid, user.id);

      return { status: 201, body: { success: true, data: { id: info.lastInsertRowid, status: 'PENDING', consumption_kwh } } };
    } catch (err) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: err.message } } };
    }
  }

  // --- Approvals & Workflow ---
  processApproval(user, recordType, recordId, decision, comment) {
    const authCheck = this.requireRole(user, ['SUPERVISOR', 'MANAGER']);
    if (authCheck) return authCheck;

    if (!['APPROVE', 'REJECT', 'REQUEST_CORRECTION'].includes(decision)) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid decision" } } };
    }
    if (decision !== 'APPROVE' && (!comment || comment.trim().length === 0)) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "Comment required for rejection or correction request" } } };
    }

    const tableMap = { energy: 'energy_records', hygiene: 'hygiene_records', production: 'production_records', waste: 'waste_records' };
    const table = tableMap[recordType];
    if (!table) return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: "Unknown record type" } } };

    const record = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(recordId);
    if (!record) return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: "Record not found" } } };

    // Scoping for Supervisor
    if (user.role === 'SUPERVISOR') {
      const submitter = this.db.prepare("SELECT department_id FROM users WHERE id = ?").get(record.entered_by);
      if (submitter && submitter.department_id !== user.department_id) {
        return { status: 403, body: { success: false, error: { code: "FORBIDDEN", message: "Cannot approve records outside your department" } } };
      }
    }

    let newStatus = 'PENDING';
    let action = 'SUBMITTED';
    if (decision === 'APPROVE') {
      newStatus = 'APPROVED';
      action = 'APPROVED';
    } else if (decision === 'REJECT') {
      newStatus = 'REJECTED';
      action = 'REJECTED';
    } else if (decision === 'REQUEST_CORRECTION') {
      newStatus = 'CORRECTION_REQUESTED';
      action = 'CORRECTION_REQUESTED';
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE ${table}
      SET status = ?, reviewed_by = ?, reviewed_at = ?, review_comment = ?
      WHERE id = ?
    `).run(newStatus, user.id, now, comment || null, recordId);

    this.db.prepare(`
      INSERT INTO approval_history (record_type, record_id, action, acted_by, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(recordType, recordId, action, user.id, comment || null);

    // Section G: Automated Anomaly Alert Generation upon approval
    let generatedAlert = null;
    if (newStatus === 'APPROVED' && recordType === 'energy') {
      const currentRecord = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(recordId);
      generatedAlert = this.checkEnergyAnomaly(currentRecord);
    }

    return {
      status: 200,
      body: {
        success: true,
        data: { id: recordId, status: newStatus, reviewed_at: now, alert_triggered: generatedAlert !== null }
      }
    };
  }

  // --- Resubmission after Correction Requested ---
  resubmitEnergyRecord(user, recordId, updatePayload) {
    const record = this.db.prepare("SELECT * FROM energy_records WHERE id = ?").get(recordId);
    if (!record) return { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: "Record not found" } } };

    if (record.entered_by !== user.id) {
      return { status: 403, body: { success: false, error: { code: "FORBIDDEN", message: "Only the original author can edit or resubmit this record" } } };
    }
    if (!['PENDING', 'CORRECTION_REQUESTED'].includes(record.status)) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "Cannot edit an approved or rejected record" } } };
    }

    const reading_start_kwh = updatePayload.reading_start_kwh !== undefined ? updatePayload.reading_start_kwh : record.reading_start_kwh;
    const reading_end_kwh = updatePayload.reading_end_kwh !== undefined ? updatePayload.reading_end_kwh : record.reading_end_kwh;
    const runtime_hours = updatePayload.runtime_hours !== undefined ? updatePayload.runtime_hours : record.runtime_hours;
    const notes = updatePayload.notes !== undefined ? updatePayload.notes : record.notes;

    if (reading_end_kwh < reading_start_kwh) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "reading_end_kwh cannot be less than reading_start_kwh" } } };
    }

    const consumption_kwh = Math.round((reading_end_kwh - reading_start_kwh) * 100) / 100;
    this.db.prepare(`
      UPDATE energy_records
      SET reading_start_kwh = ?, reading_end_kwh = ?, consumption_kwh = ?, runtime_hours = ?, notes = ?, status = 'PENDING'
      WHERE id = ?
    `).run(reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, notes, recordId);

    this.db.prepare(`
      INSERT INTO approval_history (record_type, record_id, action, acted_by, comment)
      VALUES ('energy', ?, 'RESUBMITTED', ?, 'Corrected and resubmitted by employee')
    `).run(recordId, user.id);

    return { status: 200, body: { success: true, data: { id: recordId, status: 'PENDING' } } };
  }

  // --- Section G Energy Anomaly Rule Engine ---
  checkEnergyAnomaly(record) {
    const baseline = this.db.prepare(`
      SELECT * FROM energy_baselines WHERE machine_id = ? AND shift = ?
    `).get(record.machine_id, record.shift);

    if (!baseline || baseline.sample_count < 5) {
      return null; // Not enough history yet
    }

    const mean = baseline.mean_kwh;
    const std = baseline.std_dev_kwh;
    const val = record.consumption_kwh;

    let severity = null;
    if (val > mean + 3 * std) {
      severity = 'HIGH';
    } else if (val > mean + 2 * std) {
      severity = 'MEDIUM';
    }

    if (!severity) return null;

    const evidence = {
      consumption_kwh: val,
      baseline_mean_kwh: mean,
      baseline_std_dev_kwh: std,
      deviation_kwh: Math.round((val - mean) * 100) / 100,
      sample_count: baseline.sample_count
    };

    const title = `Elevated Energy Consumption: Machine #${record.machine_id}`;
    const explanation = `Consumption of ${val} kWh exceeds shift baseline mean (${mean} kWh) by > ${severity === 'HIGH' ? '3' : '2'} standard deviations.`;
    const recommendation = "Inspect equipment runtime load and mechanical components for friction or bypass leak.";

    const info = this.db.prepare(`
      INSERT INTO alerts (alert_type, source_record_type, source_record_id, severity, status, title, explanation, evidence_json, recommended_action)
      VALUES ('ENERGY', 'energy', ?, ?, 'OPEN', ?, ?, ?, ?)
    `).run(record.id, severity, title, explanation, JSON.stringify(evidence), recommendation);

    return { alert_id: info.lastInsertRowid, severity };
  }

  // --- Alert Review (Manager Only) ---
  reviewAlert(user, alertId, newStatus, comment) {
    const authCheck = this.requireRole(user, ['MANAGER']);
    if (authCheck) return authCheck;

    if (!['UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'].includes(newStatus)) {
      return { status: 400, body: { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid alert status" } } };
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE alerts
      SET status = ?, reviewed_by = ?, reviewed_at = ?, review_comment = ?
      WHERE id = ?
    `).run(newStatus, user.id, now, comment || null, alertId);

    return { status: 200, body: { success: true, data: { id: alertId, status: newStatus } } };
  }

  // --- Dashboard Data ---
  getDashboardSummary() {
    const pendingCount = this.db.prepare("SELECT COUNT(*) AS c FROM v_pending_approvals").get().c;
    const activeAlerts = this.db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status IN ('OPEN', 'UNDER_REVIEW')").get().c;
    const todayEnergy = this.db.prepare("SELECT COALESCE(SUM(total_consumption_kwh), 0) AS total FROM v_energy_daily_by_machine WHERE record_date = (SELECT MAX(record_date) FROM v_energy_daily_by_machine)").get().total;

    return {
      status: 200,
      body: {
        success: true,
        data: {
          pending_approvals: pendingCount,
          active_alerts: activeAlerts,
          today_energy_kwh: todayEnergy
        }
      }
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = SmartTrustApi;
