const { getDatabase } = require('../config/database');

const productionRepository = {
  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT pr.*, p.name as product_name, p.product_code, p.expected_loss_percent,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM production_records pr
      JOIN products p ON pr.product_id = p.id
      JOIN users u ON pr.entered_by = u.id
      LEFT JOIN users rv ON pr.reviewed_by = rv.id
      WHERE pr.id = ?
    `).get(id);
  },

  create({ product_id, batch_no, production_date, shift, raw_input_qty, actual_output_qty, unit, entered_by, notes = null }) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO production_records (
        product_id, batch_no, production_date, shift, raw_input_qty,
        actual_output_qty, unit, entered_by, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const result = stmt.run(
      product_id,
      batch_no,
      production_date,
      shift,
      raw_input_qty,
      actual_output_qty,
      unit,
      entered_by,
      notes,
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
    db.prepare(`UPDATE production_records SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  findAll({ user, page = 1, pageSize = 20, status, from, to, product_id } = {}) {
    const db = getDatabase();
    let query = `
      SELECT pr.*, p.name as product_name, p.product_code, p.expected_loss_percent,
             u.full_name as entered_by_name,
             rv.full_name as reviewed_by_name
      FROM production_records pr
      JOIN products p ON pr.product_id = p.id
      JOIN users u ON pr.entered_by = u.id
      LEFT JOIN users rv ON pr.reviewed_by = rv.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM production_records pr
      JOIN users u ON pr.entered_by = u.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (user.role === 'EMPLOYEE') {
      query += ' AND pr.entered_by = ?';
      countQuery += ' AND pr.entered_by = ?';
      params.push(user.id);
      countParams.push(user.id);
    } else if (user.role === 'SUPERVISOR') {
      // Supervisor sees department records
      query += ' AND u.department_id = ?';
      countQuery += ' AND u.department_id = ?';
      params.push(user.departmentId);
      countParams.push(user.departmentId);
    }

    if (status) {
      query += ' AND pr.status = ?';
      countQuery += ' AND pr.status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (from) {
      query += ' AND pr.production_date >= ?';
      countQuery += ' AND pr.production_date >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      query += ' AND pr.production_date <= ?';
      countQuery += ' AND pr.production_date <= ?';
      params.push(to);
      countParams.push(to);
    }
    if (product_id) {
      query += ' AND pr.product_id = ?';
      countQuery += ' AND pr.product_id = ?';
      params.push(product_id);
      countParams.push(product_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY pr.production_date DESC, pr.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = productionRepository;
