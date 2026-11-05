const dashboardService = require('../services/dashboard.service');
const { successEnvelope } = require('../utils/envelope');

const dashboardController = {
  getSummary(req, res, next) {
    try {
      const summary = dashboardService.getSummary(req.user);
      res.json(successEnvelope(summary));
    } catch (err) {
      next(err);
    }
  },

  getEnergyTrend(req, res, next) {
    try {
      const trend = dashboardService.getEnergyTrend(req.query);
      res.json(successEnvelope(trend));
    } catch (err) {
      next(err);
    }
  },

  getHygieneCompliance(req, res, next) {
    try {
      const compliance = dashboardService.getHygieneCompliance(req.query);
      res.json(successEnvelope(compliance));
    } catch (err) {
      next(err);
    }
  },

  getWasteSummary(req, res, next) {
    try {
      const summary = dashboardService.getWasteSummary(req.query);
      res.json(successEnvelope(summary));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = dashboardController;
