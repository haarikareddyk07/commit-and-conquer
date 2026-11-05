const { getDatabase } = require('../config/database');
const { successEnvelope } = require('../utils/envelope');

const healthController = {
  checkHealth(req, res, next) {
    try {
      const db = getDatabase();
      const dbCheck = db.prepare('SELECT 1 as healthy').get();
      res.json(successEnvelope({
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: dbCheck && dbCheck.healthy === 1 ? 'CONNECTED' : 'DISCONNECTED'
      }));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = healthController;
