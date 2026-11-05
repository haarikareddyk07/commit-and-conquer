const { getDatabase } = require('../config/database');

const auditRepository = {
  log(userId, action, entity, entityId = null, ipAddress = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, acted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId || null, action, entity, entityId || null, ipAddress || null, new Date().toISOString());
  },

  findAll({ page = 1, pageSize = 20, userId, action, entity } = {}) {
    const db = getDatabase();
    let query = `
      SELECT al.*, u.full_name as user_name, u.email as user_email
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1';
    const params = [];
    const countParams = [];

    if (userId) {
      query += ' AND al.user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(userId);
      countParams.push(userId);
    }
    if (action) {
      query += ' AND al.action = ?';
      countQuery += ' AND action = ?';
      params.push(action);
      countParams.push(action);
    }
    if (entity) {
      query += ' AND al.entity = ?';
      countQuery += ' AND entity = ?';
      params.push(entity);
      countParams.push(entity);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY al.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  }
};

module.exports = auditRepository;
