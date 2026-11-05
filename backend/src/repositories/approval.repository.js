const { getDatabase } = require('../config/database');

const approvalRepository = {
  addHistory(recordType, recordId, action, actedBy, comment = null) {
    const db = getDatabase();
    const now = new Date().toISOString();
    return db.prepare(`
      INSERT INTO approval_history (record_type, record_id, action, acted_by, comment, acted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recordType, recordId, action, actedBy, comment || null, now);
  },

  getHistory(recordType, recordId) {
    const db = getDatabase();
    let query = `
      SELECT ah.*, u.full_name as acted_by_name, u.role as acted_by_role
      FROM approval_history ah
      JOIN users u ON ah.acted_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (recordType) {
      query += ' AND ah.record_type = ?';
      params.push(recordType);
    }
    if (recordId) {
      query += ' AND ah.record_id = ?';
      params.push(recordId);
    }
    query += ' ORDER BY ah.id ASC';
    return db.prepare(query).all(...params);
  },

  findPendingQueue(user, { type, department_id, from, to } = {}) {
    const db = getDatabase();
    const items = [];

    // Helper condition for supervisor
    const supervisorDept = user.role === 'SUPERVISOR' ? user.departmentId : (department_id || null);

    // 1. Energy Pending
    if (!type || type === 'energy') {
      let q = `
        SELECT 'energy' as record_type, er.id as record_id, er.record_date as date, er.shift,
               er.status, er.consumption_kwh, er.notes, er.created_at,
               m.name as target_name, m.machine_code as target_code, m.department_id,
               d.name as department_name,
               u.full_name as entered_by_name
        FROM energy_records er
        JOIN machines m ON er.machine_id = m.id
        JOIN departments d ON m.department_id = d.id
        JOIN users u ON er.entered_by = u.id
        WHERE er.status = 'PENDING'
      `;
      const p = [];
      if (supervisorDept) {
        q += ' AND m.department_id = ?';
        p.push(supervisorDept);
      }
      if (from) {
        q += ' AND er.record_date >= ?';
        p.push(from);
      }
      if (to) {
        q += ' AND er.record_date <= ?';
        p.push(to);
      }
      items.push(...db.prepare(q).all(...p));
    }

    // 2. Hygiene Pending
    if (!type || type === 'hygiene') {
      let q = `
        SELECT 'hygiene' as record_type, hr.id as record_id, hr.scheduled_date as date, ss.shift,
               hr.status, hr.chemical_used, hr.concentration_percent, hr.contact_minutes, hr.notes, hr.created_at,
               a.name as target_name, ss.task_name as target_code, a.department_id,
               d.name as department_name,
               u.full_name as entered_by_name
        FROM hygiene_records hr
        JOIN sanitation_schedules ss ON hr.schedule_id = ss.id
        JOIN areas a ON hr.area_id = a.id
        JOIN departments d ON a.department_id = d.id
        JOIN users u ON hr.entered_by = u.id
        WHERE hr.status = 'PENDING'
      `;
      const p = [];
      if (supervisorDept) {
        q += ' AND a.department_id = ?';
        p.push(supervisorDept);
      }
      if (from) {
        q += ' AND hr.scheduled_date >= ?';
        p.push(from);
      }
      if (to) {
        q += ' AND hr.scheduled_date <= ?';
        p.push(to);
      }
      items.push(...db.prepare(q).all(...p));
    }

    // 3. Production Pending
    if (!type || type === 'production') {
      let q = `
        SELECT 'production' as record_type, pr.id as record_id, pr.production_date as date, pr.shift,
               pr.status, pr.raw_input_qty, pr.actual_output_qty, pr.unit, pr.notes, pr.created_at,
               p.name as target_name, pr.batch_no as target_code, u.department_id,
               d.name as department_name,
               u.full_name as entered_by_name
        FROM production_records pr
        JOIN products p ON pr.product_id = p.id
        JOIN users u ON pr.entered_by = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE pr.status = 'PENDING'
      `;
      const p = [];
      if (supervisorDept) {
        q += ' AND u.department_id = ?';
        p.push(supervisorDept);
      }
      if (from) {
        q += ' AND pr.production_date >= ?';
        p.push(from);
      }
      if (to) {
        q += ' AND pr.production_date <= ?';
        p.push(to);
      }
      items.push(...db.prepare(q).all(...p));
    }

    // 4. Waste Pending
    if (!type || type === 'waste') {
      let q = `
        SELECT 'waste' as record_type, wr.id as record_id, wr.record_date as date, wr.shift,
               wr.status, wr.waste_type, wr.quantity, wr.unit, wr.cause as notes, wr.created_at,
               m.name as target_name, wr.waste_type as target_code, u.department_id,
               d.name as department_name,
               u.full_name as entered_by_name
        FROM waste_records wr
        JOIN materials m ON wr.material_id = m.id
        JOIN users u ON wr.entered_by = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE wr.status = 'PENDING'
      `;
      const p = [];
      if (supervisorDept) {
        q += ' AND u.department_id = ?';
        p.push(supervisorDept);
      }
      if (from) {
        q += ' AND wr.record_date >= ?';
        p.push(from);
      }
      if (to) {
        q += ' AND wr.record_date <= ?';
        p.push(to);
      }
      items.push(...db.prepare(q).all(...p));
    }

    // Sort by created_at DESC
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return items;
  },

  applyDecision(recordType, recordId, decision, reviewerId, comment = null) {
    const db = getDatabase();
    const tableMap = {
      energy: 'energy_records',
      hygiene: 'hygiene_records',
      production: 'production_records',
      waste: 'waste_records'
    };

    const tableName = tableMap[recordType];
    if (!tableName) throw new Error(`Invalid record type: ${recordType}`);

    const statusMap = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      REQUEST_CORRECTION: 'CORRECTION_REQUESTED'
    };
    const newStatus = statusMap[decision];
    const now = new Date().toISOString();

    const executeTx = db.transaction(() => {
      // 1. Update the record
      const updateStmt = db.prepare(`
        UPDATE ${tableName}
        SET status = ?, reviewed_by = ?, reviewed_at = ?, review_comment = ?
        WHERE id = ?
      `);
      const updateRes = updateStmt.run(newStatus, reviewerId, now, comment || null, recordId);
      if (updateRes.changes === 0) {
        throw new Error('Record not found');
      }

      // 2. Insert approval_history row
      const histStmt = db.prepare(`
        INSERT INTO approval_history (record_type, record_id, action, acted_by, comment, acted_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      histStmt.run(recordType, recordId, newStatus, reviewerId, comment || null, now);

      // Return updated record
      return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(recordId);
    });

    return executeTx();
  }
};

module.exports = approvalRepository;
