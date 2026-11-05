const { getDatabase } = require('../config/database');

const hygieneRepository = {
  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT hr.*, ss.task_name, ss.due_time, ss.required_chemical, ss.min_concentration_percent,
             ss.max_concentration_percent, ss.min_contact_minutes,
             a.name as area_name, a.department_id,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name,
             up.original_name as upload_name, up.stored_name as upload_stored_name
      FROM hygiene_records hr
      JOIN sanitation_schedules ss ON hr.schedule_id = ss.id
      JOIN areas a ON hr.area_id = a.id
      JOIN users u ON hr.entered_by = u.id
      LEFT JOIN users rv ON hr.reviewed_by = rv.id
      LEFT JOIN uploads up ON hr.upload_id = up.id
      WHERE hr.id = ?
    `).get(id);
  },

  create({ schedule_id, area_id, entered_by, scheduled_date, completed_at, chemical_used, concentration_percent, contact_minutes, checklist_json = null, upload_id = null, notes = null }) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const checklistStr = typeof checklist_json === 'object' && checklist_json !== null 
      ? JSON.stringify(checklist_json) 
      : checklist_json;

    const stmt = db.prepare(`
      INSERT INTO hygiene_records (
        schedule_id, area_id, entered_by, scheduled_date, completed_at, chemical_used,
        concentration_percent, contact_minutes, checklist_json, upload_id, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const result = stmt.run(
      schedule_id,
      area_id,
      entered_by,
      scheduled_date,
      completed_at,
      chemical_used,
      concentration_percent,
      contact_minutes,
      checklistStr,
      upload_id || null,
      notes,
      now
    );

    return this.findById(result.lastInsertRowid);
  },

  update(id, fields) {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    if (fields.checklist_json && typeof fields.checklist_json === 'object') {
      fields.checklist_json = JSON.stringify(fields.checklist_json);
    }

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(val);
    }

    if (setClauses.length === 0) return current;

    values.push(id);
    db.prepare(`UPDATE hygiene_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  findAll({ user, page = 1, pageSize = 20, status, from, to, area_id } = {}) {
    const db = getDatabase();
    let query = `
      SELECT hr.*, ss.task_name, ss.due_time, ss.required_chemical,
             a.name as area_name, a.department_id,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM hygiene_records hr
      JOIN sanitation_schedules ss ON hr.schedule_id = ss.id
      JOIN areas a ON hr.area_id = a.id
      JOIN users u ON hr.entered_by = u.id
      LEFT JOIN users rv ON hr.reviewed_by = rv.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM hygiene_records hr
      JOIN areas a ON hr.area_id = a.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (user.role === 'EMPLOYEE') {
      query += ' AND hr.entered_by = ?';
      countQuery += ' AND hr.entered_by = ?';
      params.push(user.id);
      countParams.push(user.id);
    } else if (user.role === 'SUPERVISOR') {
      query += ' AND a.department_id = ?';
      countQuery += ' AND a.department_id = ?';
      params.push(user.departmentId);
      countParams.push(user.departmentId);
    }

    if (status) {
      query += ' AND hr.status = ?';
      countQuery += ' AND hr.status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (from) {
      query += ' AND hr.scheduled_date >= ?';
      countQuery += ' AND hr.scheduled_date >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      query += ' AND hr.scheduled_date <= ?';
      countQuery += ' AND hr.scheduled_date <= ?';
      params.push(to);
      countParams.push(to);
    }
    if (area_id) {
      query += ' AND hr.area_id = ?';
      countQuery += ' AND hr.area_id = ?';
      params.push(area_id);
      countParams.push(area_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY hr.scheduled_date DESC, hr.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = hygieneRepository;
