function getRecommendations(db) {
  // Fetch active alerts ordered by severity
  const openAlerts = db.prepare(`
    SELECT a.*,
      CASE 
        WHEN a.severity = 'HIGH' THEN 1
        WHEN a.severity = 'MEDIUM' THEN 2
        ELSE 3
      END as priority_rank
    FROM alerts a
    WHERE a.status IN ('OPEN', 'UNDER_REVIEW')
    ORDER BY priority_rank ASC, a.detected_at DESC
    LIMIT 10
  `).all();

  const recommendations = openAlerts.map(alert => ({
    id: `rec-alert-${alert.id}`,
    alert_id: alert.id,
    type: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    action: alert.recommended_action,
    reason: alert.explanation,
    detected_at: alert.detected_at,
    priority: alert.severity === 'HIGH' ? 'Immediate Attention' : 'Scheduled Review'
  }));

  // Pattern detection: Machines with high consumption
  const frequentEnergyDeviations = db.prepare(`
    SELECT m.name as machine_name, COUNT(a.id) as alert_count
    FROM alerts a
    JOIN energy_records er ON a.source_record_id = er.id AND a.source_record_type = 'energy'
    JOIN machines m ON er.machine_id = m.id
    WHERE a.status != 'DISMISSED'
    GROUP BY m.name
    HAVING alert_count >= 2
  `).all();

  for (const item of frequentEnergyDeviations) {
    recommendations.push({
      id: `rec-pattern-energy-${item.machine_name.replace(/\s+/g, '-').toLowerCase()}`,
      alert_id: null,
      type: 'ENERGY',
      severity: 'HIGH',
      title: `Recurring Energy Inefficiency on ${item.machine_name}`,
      action: `Perform preventative maintenance and thermal/motor efficiency audit on ${item.machine_name}.`,
      reason: `${item.machine_name} has triggered ${item.alert_count} energy anomalies recently. Persistent above-baseline consumption indicates mechanical degradation.`,
      detected_at: new Date().toISOString(),
      priority: 'High Priority Maintenance'
    });
  }

  // If recommendations is empty, return standard preventative guidance
  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec-general-1',
      alert_id: null,
      type: 'ENERGY',
      severity: 'LOW',
      title: 'Routine Pasteuriser Heat Exchanger Inspection',
      action: 'Check plate heat exchangers for milk stone scale buildup before next production run.',
      reason: 'Regular CIP descaling maintains heat transfer efficiency and saves up to 8% steam/energy.',
      detected_at: new Date().toISOString(),
      priority: 'Good Practice'
    });
    recommendations.push({
      id: 'rec-general-2',
      alert_id: null,
      type: 'HYGIENE',
      severity: 'LOW',
      title: 'Verify Chemical Dispenser Calibration',
      action: 'Perform weekly titrations to ensure chemical concentration sensors match laboratory standards.',
      reason: 'Prevents under-dosing (poor sanitation) and over-dosing (chemical wastage).',
      detected_at: new Date().toISOString(),
      priority: 'Good Practice'
    });
  }

  return recommendations;
}

module.exports = {
  getRecommendations
};
