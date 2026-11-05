const { createAlert } = require('./alertService');

function evaluateHygieneRecord(db, recordId) {
  const record = db.prepare(`
    SELECT hr.*, ss.task_name, ss.due_time, ss.grace_minutes, ss.required_chemical,
           ss.min_concentration_percent, ss.max_concentration_percent, ss.min_contact_minutes,
           a.name as area_name
    FROM hygiene_records hr
    JOIN sanitation_schedules ss ON hr.schedule_id = ss.id
    JOIN areas a ON hr.area_id = a.id
    WHERE hr.id = ?
  `).get(recordId);

  if (!record || record.status !== 'APPROVED') {
    return null;
  }

  const findings = [];
  let severity = 'LOW';

  // 1. Chemical match
  if (record.chemical_used.trim().toLowerCase() !== record.required_chemical.trim().toLowerCase()) {
    findings.push('WRONG_CHEMICAL');
    severity = 'HIGH';
  }

  // 2. Concentration range
  if (record.concentration_percent < record.min_concentration_percent ||
      record.concentration_percent > record.max_concentration_percent) {
    findings.push('CONCENTRATION_OUT_OF_RANGE');
    if (severity !== 'HIGH') severity = 'MEDIUM';
  }

  // 3. Contact time
  if (record.contact_minutes < record.min_contact_minutes) {
    findings.push('CONTACT_TIME_TOO_SHORT');
    if (severity !== 'HIGH') severity = 'MEDIUM';
  }

  // 4. Checklist check
  if (record.checklist_json) {
    try {
      const parsed = JSON.parse(record.checklist_json);
      const values = Object.values(parsed);
      if (values.some(v => v === false || v === null || v === '')) {
        findings.push('CHECKLIST_INCOMPLETE');
      }
    } catch(e) {}
  }

  // 5. Lateness check
  if (record.completed_at && record.due_time) {
    try {
      const completedDate = new Date(record.completed_at);
      const [dueH, dueM] = record.due_time.split(':').map(Number);
      const dueDate = new Date(record.scheduled_date + 'T' + record.due_time + ':00Z');
      const allowedTime = new Date(dueDate.getTime() + (record.grace_minutes || 30) * 60000);
      if (completedDate > allowedTime) {
        findings.push('LATE');
      }
    } catch(e) {}
  }

  if (findings.length > 0) {
    const title = `Hygiene Non-Conformance on ${record.area_name}`;
    const explanation = `Sanitation entry for ${record.task_name} in ${record.area_name} on ${record.scheduled_date} revealed non-compliant parameters: ${findings.join(', ')}. Recorded: Chemical: "${record.chemical_used}" (Required: "${record.required_chemical}"), Concentration: ${record.concentration_percent}% (Required: ${record.min_concentration_percent}–${record.max_concentration_percent}%), Contact Time: ${record.contact_minutes}m (Required min: ${record.min_contact_minutes}m). Note: Software compares records only; it does not physically verify sanitation.`;
    const evidence = {
      findings,
      recorded_chemical: record.chemical_used,
      required_chemical: record.required_chemical,
      recorded_concentration_percent: record.concentration_percent,
      required_range: [record.min_concentration_percent, record.max_concentration_percent],
      recorded_contact_minutes: record.contact_minutes,
      required_min_contact_minutes: record.min_contact_minutes,
      scheduled_date: record.scheduled_date
    };
    const recommendedAction = 'Re-inspect the cleaned equipment, conduct an ATP swab or chemical titrate test, and re-run CIP cycle if necessary.';

    createAlert(db, {
      alertType: 'HYGIENE',
      sourceRecordType: 'hygiene',
      sourceRecordId: record.id,
      severity,
      title,
      explanation,
      evidence,
      recommendedAction
    });
  }

  return { recordId, findings, severity: findings.length > 0 ? severity : null };
}

function findMissedTasks(db, dateStr) {
  const schedules = db.prepare(`
    SELECT ss.*, a.name as area_name
    FROM sanitation_schedules ss
    JOIN areas a ON ss.area_id = a.id
  `).all();

  const missed = [];
  for (const s of schedules) {
    const existing = db.prepare(`
      SELECT id FROM hygiene_records 
      WHERE schedule_id = ? AND scheduled_date = ?
    `).get(s.id, dateStr);

    if (!existing) {
      missed.push({
        schedule_id: s.id,
        area_id: s.area_id,
        area_name: s.area_name,
        task_name: s.task_name,
        scheduled_date: dateStr,
        due_time: s.due_time,
        finding: 'MISSED'
      });
    }
  }

  return missed;
}

function getComplianceSummary(db, { from, to } = {}) {
  let query = `
    SELECT a.id as area_id, a.name as area_name,
           COUNT(hr.id) as total_submitted,
           SUM(CASE WHEN hr.status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count
    FROM areas a
    LEFT JOIN hygiene_records hr ON a.id = hr.area_id
  `;
  const params = [];

  if (from || to) {
    const conditions = [];
    if (from) {
      conditions.push('hr.scheduled_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('hr.scheduled_date <= ?');
      params.push(to);
    }
    query += ' AND ' + conditions.join(' AND ');
  }

  query += ' GROUP BY a.id, a.name ORDER BY a.name ASC';

  const rows = db.prepare(query).all(...params);

  return rows.map(r => {
    const total = r.total_submitted || 0;
    const approved = r.approved_count || 0;
    const compliance_percent = total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 100;
    return {
      area_id: r.area_id,
      area_name: r.area_name,
      total_records: total,
      approved_records: approved,
      compliance_percent
    };
  });
}

module.exports = {
  evaluateHygieneRecord,
  findMissedTasks,
  getComplianceSummary
};
