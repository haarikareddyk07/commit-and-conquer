const { getDatabase } = require('../config/database');

const userRepository = {
  findByEmail(email) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(id);
  },

  create({ full_name, email, password_hash, role, department_id, is_active = 1 }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(full_name, email, password_hash, role, department_id || null, is_active);
    return this.findById(result.lastInsertRowid);
  },

  update(id, fields) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(val);
    }

    if (setClauses.length === 0) return this.findById(id);

    values.push(id);
    db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  findAll({ page = 1, pageSize = 20, role, department_id, is_active } = {}) {
    const db = getDatabase();
    let query = `
      SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];
    const countParams = [];

    if (role) {
      query += ' AND u.role = ?';
      countQuery += ' AND role = ?';
      params.push(role);
      countParams.push(role);
    }
    if (department_id) {
      query += ' AND u.department_id = ?';
      countQuery += ' AND department_id = ?';
      params.push(department_id);
      countParams.push(department_id);
    }
    if (is_active !== undefined) {
      query += ' AND u.is_active = ?';
      countQuery += ' AND is_active = ?';
      params.push(is_active);
      countParams.push(is_active);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY u.id ASC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = userRepository;
