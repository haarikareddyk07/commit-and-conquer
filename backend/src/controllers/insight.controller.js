const analytics = require('../analytics');
const { getDatabase } = require('../config/database');
const { successEnvelope } = require('../utils/envelope');

const insightController = {
  getRecommendations(req, res, next) {
    try {
      const db = getDatabase();
      const recommendations = analytics.getRecommendations(db);
      res.json(successEnvelope(recommendations));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = insightController;
