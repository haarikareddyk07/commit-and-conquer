const { createAlert } = require('./alertService');

function calculateBaseline(db, machineId, shift) {
  const records = db.prepare(`
    SELECT consumption_kwh FROM energy_records
    WHERE machine_id = ? AND shift = ? AND status = 'APPROVED'
    ORDER BY record_date DESC, id DESC
    LIMIT 30
  `).all(machineId, shift);

  if (records.length < 5) {
    return {
      insufficient_data: true,
      reason: 'Not enough history yet (requires at least 5 approved records)',
      sample_count: records.length,
      mean_kwh: null,
      std_dev_kwh: null
    };
  }

  const values = records.map(r => r.consumption_kwh);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Update or insert energy_baselines table
  const existing = db.prepare('SELECT id FROM energy_baselines WHERE machine_id = ? AND shift = ?').get(machineId, shift);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE energy_baselines 
      SET mean_kwh = ?, std_dev_kwh = ?, sample_count = ?, calculated_at = ?
      WHERE id = ?
    `).run(Number(mean.toFixed(2)), Number(stdDev.toFixed(2)), records.length, now, existing.id);
  } else {
    db.prepare(`
      INSERT INTO energy_baselines (machine_id, shift, mean_kwh, std_dev_kwh, sample_count, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(machineId, shift, Number(mean.toFixed(2)), Number(stdDev.toFixed(2)), records.length, now);
  }

  return {
    insufficient_data: false,
    machine_id: machineId,
    shift,
    sample_count: records.length,
    mean_kwh: Number(mean.toFixed(2)),
    std_dev_kwh: Number(stdDev.toFixed(2))
  };
}

function recomputeAllBaselines(db) {
  const machineShifts = db.prepare(`
    SELECT DISTINCT machine_id, shift FROM energy_records WHERE status = 'APPROVED'
  `).all();

  const results = [];
  for (const ms of machineShifts) {
    const res = calculateBaseline(db, ms.machine_id, ms.shift);
    results.push(res);
  }
  return results;
}

function evaluateEnergyRecord(db, recordId) {
  const record = db.prepare(`
    SELECT er.*, m.name as machine_name, m.machine_code
    FROM energy_records er
    JOIN machines m ON er.machine_id = m.id
    WHERE er.id = ?
  `).get(recordId);

  if (!record || record.status !== 'APPROVED') {
    return null;
  }

  const baseline = calculateBaseline(db, record.machine_id, record.shift);
  if (baseline.insufficient_data || !baseline.std_dev_kwh) {
    return null;
  }

  const mean = baseline.mean_kwh;
  const std = baseline.std_dev_kwh;
  const consumption = record.consumption_kwh;

  let severity = null;
  if (consumption > mean + 3 * std) {
    severity = 'HIGH';
  } else if (consumption > mean + 2 * std) {
    severity = 'MEDIUM';
  }

  if (severity) {
    const pctAbove = Math.round(((consumption - mean) / mean) * 100);
    const title = `Elevated Energy Consumption on ${record.machine_name}`;
    const explanation = `${record.machine_name} (${record.machine_code}) recorded ${consumption} kWh during the ${record.shift.toLowerCase()} shift on ${record.record_date}. The baseline is ${mean} kWh (±${std} kWh) based on ${baseline.sample_count} approved records. This is ${pctAbove}% above the typical average and exceeds the upper control boundary (${(mean + 2 * std).toFixed(1)} kWh).`;
    const evidence = {
      consumption_kwh: consumption,
      mean_kwh: mean,
      std_dev_kwh: std,
      threshold_medium: Number((mean + 2 * std).toFixed(1)),
      threshold_high: Number((mean + 3 * std).toFixed(1)),
      sample_count: baseline.sample_count,
      shift: record.shift,
      record_date: record.record_date
    };
    const recommendedAction = 'Inspect machine for mechanical fouling, excessive motor load, steam/valve leaks, or unrecorded idle runtime. Compare with shift operating logs.';

    createAlert(db, {
      alertType: 'ENERGY',
      sourceRecordType: 'energy',
      sourceRecordId: record.id,
      severity,
      title,
      explanation,
      evidence,
      recommendedAction
    });
  }

  return { recordId, severity };
}

function getEnergyTrend(db, { from, to, machineId } = {}) {
  let query = `
    SELECT er.record_date, er.shift, er.machine_id, m.name as machine_name,
           SUM(er.consumption_kwh) as total_consumption_kwh,
           AVG(er.consumption_kwh) as avg_consumption_kwh,
           COUNT(*) as record_count
    FROM energy_records er
    JOIN machines m ON er.machine_id = m.id
    WHERE er.status = 'APPROVED'
  `;
  const params = [];

  if (from) {
    query += ' AND er.record_date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND er.record_date <= ?';
    params.push(to);
  }
  if (machineId) {
    query += ' AND er.machine_id = ?';
    params.push(machineId);
  }

  query += ' GROUP BY er.record_date, er.machine_id, er.shift ORDER BY er.record_date ASC';

  const rows = db.prepare(query).all(...params);

  // Attach baseline if available
  return rows.map(r => {
    const b = db.prepare('SELECT mean_kwh, std_dev_kwh FROM energy_baselines WHERE machine_id = ? AND shift = ?').get(r.machine_id, r.shift);
    return {
      record_date: r.record_date,
      shift: r.shift,
      machine_id: r.machine_id,
      machine_name: r.machine_name,
      consumption_kwh: r.total_consumption_kwh,
      baseline_mean: b ? b.mean_kwh : null,
      baseline_upper_band: b ? Number((b.mean_kwh + 2 * b.std_dev_kwh).toFixed(2)) : null
    };
  });
}

module.exports = {
  calculateBaseline,
  recomputeAllBaselines,
  evaluateEnergyRecord,
  getEnergyTrend
};
