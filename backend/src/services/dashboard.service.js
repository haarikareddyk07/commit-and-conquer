const { getDatabase } = require('../config/database');
const analytics = require('../analytics');

const dashboardService = {
  getSummary(user) {
    const db = getDatabase();

    // 1. Pending approvals count
    let pendingEnergyQ = "SELECT COUNT(*) as count FROM energy_records WHERE status = 'PENDING'";
    let pendingHygieneQ = "SELECT COUNT(*) as count FROM hygiene_records WHERE status = 'PENDING'";
    let pendingProdQ = "SELECT COUNT(*) as count FROM production_records WHERE status = 'PENDING'";
    let pendingWasteQ = "SELECT COUNT(*) as count FROM waste_records WHERE status = 'PENDING'";
    const params = [];

    if (user.role === 'SUPERVISOR') {
      pendingEnergyQ = "SELECT COUNT(*) as count FROM energy_records er JOIN machines m ON er.machine_id = m.id WHERE er.status = 'PENDING' AND m.department_id = ?";
      pendingHygieneQ = "SELECT COUNT(*) as count FROM hygiene_records hr JOIN areas a ON hr.area_id = a.id WHERE hr.status = 'PENDING' AND a.department_id = ?";
      pendingProdQ = "SELECT COUNT(*) as count FROM production_records pr JOIN users u ON pr.entered_by = u.id WHERE pr.status = 'PENDING' AND u.department_id = ?";
      pendingWasteQ = "SELECT COUNT(*) as count FROM waste_records wr JOIN users u ON wr.entered_by = u.id WHERE wr.status = 'PENDING' AND u.department_id = ?";
      params.push(user.departmentId);
    }

    const pendingEnergy = db.prepare(pendingEnergyQ).get(...(user.role === 'SUPERVISOR' ? params : []))?.count || 0;
    const pendingHygiene = db.prepare(pendingHygieneQ).get(...(user.role === 'SUPERVISOR' ? params : []))?.count || 0;
    const pendingProd = db.prepare(pendingProdQ).get(...(user.role === 'SUPERVISOR' ? params : []))?.count || 0;
    const pendingWaste = db.prepare(pendingWasteQ).get(...(user.role === 'SUPERVISOR' ? params : []))?.count || 0;
    const totalPendingApprovals = pendingEnergy + pendingHygiene + pendingProd + pendingWaste;

    // 2. Open alerts count
    const openAlertsCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('OPEN', 'UNDER_REVIEW')").get()?.count || 0;

    // 3. Energy today vs baseline
    const todayStr = new Date().toISOString().split('T')[0];
    const energyToday = db.prepare(`
      SELECT SUM(consumption_kwh) as total_kwh, COUNT(*) as count 
      FROM energy_records 
      WHERE record_date = ? AND status = 'APPROVED'
    `).get(todayStr);

    const baselineSum = db.prepare('SELECT SUM(mean_kwh) as sum_mean FROM energy_baselines').get();
    const todayKwh = energyToday ? (energyToday.total_kwh || 0) : 0;
    const expectedKwh = baselineSum ? (baselineSum.sum_mean || 0) : 0;

    // 4. Overall hygiene compliance %
    const hygieneCompliance = analytics.getComplianceSummary(db);
    let totalHygieneRecords = 0;
    let approvedHygieneRecords = 0;
    hygieneCompliance.forEach(hc => {
      totalHygieneRecords += hc.total_records;
      approvedHygieneRecords += hc.approved_records;
    });
    const overallCompliancePercent = totalHygieneRecords > 0 
      ? Number(((approvedHygieneRecords / totalHygieneRecords) * 100).toFixed(1))
      : 100;

    // 5. Waste % this week (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const prodWeek = db.prepare(`
      SELECT SUM(raw_input_qty) as total_raw, SUM(actual_output_qty) as total_actual
      FROM production_records
      WHERE production_date >= ? AND status = 'APPROVED'
    `).get(sevenDaysAgo);

    let wastePercentThisWeek = 0;
    if (prodWeek && prodWeek.total_raw > 0) {
      const loss = prodWeek.total_raw - prodWeek.total_actual;
      wastePercentThisWeek = Number(((loss / prodWeek.total_raw) * 100).toFixed(2));
    }

    return {
      pending_approvals_count: totalPendingApprovals,
      open_alerts_count: openAlertsCount,
      energy_today: {
        actual_kwh: Number(todayKwh.toFixed(1)),
        baseline_kwh: Number(expectedKwh.toFixed(1)),
        status: todayKwh <= expectedKwh ? 'NORMAL' : 'ABOVE_BASELINE'
      },
      hygiene_compliance_percent: overallCompliancePercent,
      waste_percent_this_week: wastePercentThisWeek
    };
  },

  getEnergyTrend(query) {
    const db = getDatabase();
    return analytics.getEnergyTrend(db, query);
  },

  getHygieneCompliance(query) {
    const db = getDatabase();
    return analytics.getComplianceSummary(db, query);
  },

  getWasteSummary(query) {
    const db = getDatabase();
    return analytics.getWasteSummary(db, query);
  }
};

module.exports = dashboardService;
