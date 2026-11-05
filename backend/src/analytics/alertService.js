/**
 * Alert Service for SmartTrust Analytics
 * Section G & Prompt 4:
 * Creates alerts without duplicates for the same source record,
 * assigns severity (LOW, MEDIUM, HIGH),
 * writes title, explanation, evidence_json, recommended_action, status OPEN.
 */

function createAlert(db, { alertType, sourceRecordType, sourceRecordId, severity, title, explanation, evidence, recommendedAction }) {
  // Check for duplicate alert on same source record
  const existing = db.prepare(`
    SELECT id FROM alerts 
    WHERE alert_type = ? AND source_record_type = ? AND source_record_id = ?
  `).get(alertType, sourceRecordType, sourceRecordId);

  if (existing) {
    return existing.id;
  }

  const evidenceJson = typeof evidence === 'string' ? evidence : JSON.stringify(evidence || {});
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO alerts (
      alert_type, source_record_type, source_record_id, severity, status,
      title, explanation, evidence_json, recommended_action, detected_at, created_at
    ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    alertType,
    sourceRecordType,
    sourceRecordId,
    severity,
    title,
    explanation,
    evidenceJson,
    recommendedAction,
    now,
    now
  );

  return result.lastInsertRowid;
}

module.exports = {
  createAlert
};
