const { getDatabase } = require('../config/database');

const energyRepository = {
  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT er.*, m.name as machine_name, m.machine_code, m.department_id,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM energy_records er
      JOIN machines m ON er.machine_id = m.id
      JOIN users u ON er.entered_by = u.id
      LEFT JOIN users rv ON er.reviewed_by = rv.id
      WHERE er.id = ?
    `).get(id);
  },

  create({ machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, runtime_hours, notes = null }) {
    const db = getDatabase();
    const consumption_kwh = Number((reading_end_kwh - reading_start_kwh).toFixed(2));
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO energy_records (
        machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh,
        consumption_kwh, runtime_hours, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const result = stmt.run(
      machine_id,
      entered_by,
      record_date,
      shift,
      reading_start_kwh,
      reading_end_kwh,
      consumption_kwh,
      runtime_hours,
      notes,
      now
    );

    return this.findById(result.lastInsertRowid);
  },

  update(id, fields) {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    let start = fields.reading_start_kwh !== undefined ? fields.reading_start_kwh : current.reading_start_kwh;
    let end = fields.reading_end_kwh !== undefined ? fields.reading_end_kwh : current.reading_end_kwh;
    fields.consumption_kwh = Number((end - start).toFixed(2));

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(val);
    }

    if (setClauses.length === 0) return current;

    values.push(id);
    db.prepare(`UPDATE energy_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  findAll({ user, page = 1, pageSize = 20, status, from, to, machine_id } = {}) {
    const db = getDatabase();
    let query = `
      SELECT er.*, m.name as machine_name, m.machine_code, m.department_id,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM energy_records er
      JOIN machines m ON er.machine_id = m.id
      JOIN users u ON er.entered_by = u.id
      LEFT JOIN users rv ON er.reviewed_by = rv.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM energy_records er
      JOIN machines m ON er.machine_id = m.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    // Role-based scoping
    if (user.role === 'EMPLOYEE') {
      query += ' AND er.entered_by = ?';
      countQuery += ' AND er.entered_by = ?';
      params.push(user.id);
      countParams.push(user.id);
    } else if (user.role === 'SUPERVISOR') {
      query += ' AND m.department_id = ?';
      countQuery += ' AND m.department_id = ?';
      params.push(user.departmentId);
      countParams.push(user.departmentId);
    }
    // MANAGER sees all

    if (status) {
      query += ' AND er.status = ?';
      countQuery += ' AND er.status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (from) {
      query += ' AND er.record_date >= ?';
      countQuery += ' AND er.record_date >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      query += ' AND er.record_date <= ?';
      countQuery += ' AND er.record_date <= ?';
      params.push(to);
      countParams.push(to);
    }
    if (machine_id) {
      query += ' AND er.machine_id = ?';
      countQuery += ' AND er.machine_id = ?';
      params.push(machine_id);
      countParams.push(machine_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY er.record_date DESC, er.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = energyRepository;
