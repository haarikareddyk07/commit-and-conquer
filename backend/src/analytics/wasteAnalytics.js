const { createAlert } = require('./alertService');

function evaluateProduction(db, productionRecordId) {
  const record = db.prepare(`
    SELECT pr.*, p.name as product_name, p.product_code, p.expected_loss_percent
    FROM production_records pr
    JOIN products p ON pr.product_id = p.id
    WHERE pr.id = ?
  `).get(productionRecordId);

  if (!record || record.status !== 'APPROVED') {
    return null;
  }

  const rawInput = record.raw_input_qty;
  const actualOutput = record.actual_output_qty;
  if (rawInput <= 0) return null;

  const lossQty = rawInput - actualOutput;
  const wastePercent = Number(((lossQty / rawInput) * 100).toFixed(2));
  const expectedLoss = record.expected_loss_percent;
  const excess = Number((wastePercent - expectedLoss).toFixed(2));

  let severity = null;
  if (wastePercent > 2.0 * expectedLoss) {
    severity = 'HIGH';
  } else if (wastePercent > 1.5 * expectedLoss) {
    severity = 'MEDIUM';
  }

  if (severity) {
    const title = `High Production Loss in Batch ${record.batch_no}`;
    const explanation = `Batch ${record.batch_no} of ${record.product_name} sustained a loss of ${wastePercent}% (${lossQty.toFixed(1)} ${record.unit} lost from ${rawInput} ${record.unit} raw input). Expected loss standard is ${expectedLoss}%. The loss is ${severity === 'HIGH' ? 'more than double' : '1.5x over'} standard tolerances.`;
    const evidence = {
      batch_no: record.batch_no,
      raw_input_qty: rawInput,
      actual_output_qty: actualOutput,
      loss_qty: Number(lossQty.toFixed(2)),
      waste_percent: wastePercent,
      expected_loss_percent: expectedLoss,
      excess_loss_percent: excess,
      unit: record.unit,
      production_date: record.production_date
    };
    const recommendedAction = 'Audit batch process logs for curd separation, filling head spillage, filtration loss or pipe scale accumulation.';

    createAlert(db, {
      alertType: 'WASTE',
      sourceRecordType: 'production',
      sourceRecordId: record.id,
      severity,
      title,
      explanation,
      evidence,
      recommendedAction
    });
  }

  return { productionRecordId, wastePercent, expectedLoss, excess, severity };
}

function getWasteSummary(db, { from, to } = {}) {
  let query = `
    SELECT wr.waste_type, wr.unit,
           SUM(wr.quantity) as total_quantity,
           COUNT(wr.id) as record_count,
           m.name as material_name
    FROM waste_records wr
    JOIN materials m ON wr.material_id = m.id
    WHERE wr.status = 'APPROVED'
  `;
  const params = [];

  if (from) {
    query += ' AND wr.record_date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND wr.record_date <= ?';
    params.push(to);
  }

  query += ' GROUP BY wr.waste_type, m.name, wr.unit ORDER BY total_quantity DESC';

  const rows = db.prepare(query).all(...params);

  // Also query production loss summary
  let prodQuery = `
    SELECT p.id as product_id, p.name as product_name, p.expected_loss_percent,
           SUM(pr.raw_input_qty) as total_raw_input,
           SUM(pr.actual_output_qty) as total_actual_output,
           COUNT(pr.id) as batch_count
    FROM production_records pr
    JOIN products p ON pr.product_id = p.id
    WHERE pr.status = 'APPROVED'
  `;
  const prodParams = [];

  if (from) {
    prodQuery += ' AND pr.production_date >= ?';
    prodParams.push(from);
  }
  if (to) {
    prodQuery += ' AND pr.production_date <= ?';
    prodParams.push(to);
  }

  prodQuery += ' GROUP BY p.id, p.name ORDER BY p.name ASC';

  const prodRows = db.prepare(prodQuery).all(...prodParams);

  const byProduct = prodRows.map(pr => {
    const raw = pr.total_raw_input || 0;
    const actual = pr.total_actual_output || 0;
    const loss = raw - actual;
    const actualLossPercent = raw > 0 ? Number(((loss / raw) * 100).toFixed(2)) : 0;
    return {
      product_id: pr.product_id,
      product_name: pr.product_name,
      total_raw_input: raw,
      total_actual_output: actual,
      loss_quantity: Number(loss.toFixed(2)),
      expected_loss_percent: pr.expected_loss_percent,
      actual_loss_percent: actualLossPercent,
      batch_count: pr.batch_count
    };
  });

  return {
    byWasteType: rows,
    byProduct
  };
}

module.exports = {
  evaluateProduction,
  getWasteSummary
};
