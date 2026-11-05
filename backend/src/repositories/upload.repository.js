const { getDatabase } = require('../config/database');

const uploadRepository = {
  create({ original_name, stored_name, mime_type, size_bytes, uploaded_by, related_type = null, related_id = null }) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO uploads (
        original_name, stored_name, mime_type, size_bytes, uploaded_by,
        related_type, related_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      original_name,
      stored_name,
      mime_type,
      size_bytes,
      uploaded_by,
      related_type || null,
      related_id || null,
      now
    );
    return this.findById(res.lastInsertRowid);
  },

  findById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT up.*, u.full_name as uploaded_by_name
      FROM uploads up
      JOIN users u ON up.uploaded_by = u.id
      WHERE up.id = ?
    `).get(id);
  }
};

module.exports = uploadRepository;
