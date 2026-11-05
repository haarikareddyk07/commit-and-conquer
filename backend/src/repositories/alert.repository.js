const { getDatabase } = require('../config/database');

const alertRepository = {
  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT a.*, u.full_name as reviewed_by_name
      FROM alerts a
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE a.id = ?
    `).get(id);
  },

  findAll({ page = 1, pageSize = 20, status, severity, alert_type, from, to } = {}) {
    const db = getDatabase();
    let query = `
      SELECT a.*, u.full_name as reviewed_by_name
      FROM alerts a
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM alerts WHERE 1=1';
    const params = [];
    const countParams = [];

    if (status) {
      query += ' AND a.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (severity) {
      query += ' AND a.severity = ?';
      countQuery += ' AND severity = ?';
      params.push(severity);
      countParams.push(severity);
    }
    if (alert_type) {
      query += ' AND a.alert_type = ?';
      countQuery += ' AND alert_type = ?';
      params.push(alert_type);
      countParams.push(alert_type);
    }
    if (from) {
      query += ' AND a.detected_at >= ?';
      countQuery += ' AND detected_at >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      query += ' AND a.detected_at <= ?';
      countQuery += ' AND detected_at <= ?';
      params.push(to);
      countParams.push(to);
    }

    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    query += ' ORDER BY a.detected_at DESC, a.id DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(query).all(...params);
    return { rows, total };
  },

  review(id, status, comment, reviewerId) {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE alerts
      SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(status, comment || null, reviewerId, now, id);

    return this.findById(id);
  }
};

module.exports = alertRepository;
