const { getDatabase } = require('../config/database');

const wasteRepository = {
  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT wr.*, m.name as material_name, m.material_code,
             pr.batch_no,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM waste_records wr
      JOIN materials m ON wr.material_id = m.id
      JOIN users u ON wr.entered_by = u.id
      LEFT JOIN production_records pr ON wr.production_record_id = pr.id
      LEFT JOIN users rv ON wr.reviewed_by = rv.id
      WHERE wr.id = ?
    `).get(id);
  },

  create({ production_record_id = null, material_id, record_date, shift, waste_type, quantity, unit, cause = null, entered_by }) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO waste_records (
        production_record_id, material_id, record_date, shift, waste_type,
        quantity, unit, cause, entered_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const result = stmt.run(
      production_record_id || null,
      material_id,
      record_date,
      shift,
      waste_type,
      quantity,
      unit,
      cause,
      entered_by,
      now
    );

    return this.findById(result.lastInsertRowid);
  },

  update(id, fields) {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(val);
    }

    if (setClauses.length === 0) return current;

    values.push(id);
    db.prepare(`UPDATE waste_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  findAll({ user, page = 1, pageSize = 20, status, from, to, material_id } = {}) {
    const db = getDatabase();
    let query = `
      SELECT wr.*, m.name as material_name, m.material_code,
             pr.batch_no,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM waste_records wr
      JOIN materials m ON wr.material_id = m.id
      JOIN users u ON wr.entered_by = u.id
      LEFT JOIN production_records pr ON wr.production_record_id = pr.id
      LEFT JOIN users rv ON wr.reviewed_by = rv.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM waste_records wr
      JOIN users u ON wr.entered_by = u.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (user.role === 'EMPLOYEE') {
      query += ' AND wr.entered_by = ?';
      countQuery += ' AND wr.entered_by = ?';
      params.push(user.id);
      countParams.push(user.id);
    } else if (user.role === 'SUPERVISOR') {
      query += ' AND u.department_id = ?';
      countQuery += ' AND u.department_id = ?';
      params.push(user.departmentId);
      countParams.push(user.departmentId);
    }

    if (status) {
      query += ' AND wr.status = ?';
      countQuery += ' AND wr.status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (from) {
      query += ' AND wr.record_date >= ?';
      countQuery += ' AND wr.record_date >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      query += ' AND wr.record_date <= ?';
      countQuery += ' AND wr.record_date <= ?';
      params.push(to);
      countParams.push(to);
    }
    if (material_id) {
      query += ' AND wr.material_id = ?';
      countQuery += ' AND wr.material_id = ?';
      params.push(material_id);
      countParams.push(material_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY wr.record_date DESC, wr.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = wasteRepository;
