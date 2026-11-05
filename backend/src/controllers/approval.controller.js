const approvalService = require('../services/approval.service');
const { successEnvelope } = require('../utils/envelope');

const approvalController = {
  async getPendingQueue(req, res, next) {
    try {
      const items = await approvalService.getPendingQueue(req.user, req.query);
      res.json(successEnvelope(items, { total: items.length }));
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req, res, next) {
    try {
      const { record_type, record_id } = req.query;
      const history = await approvalService.getHistory(record_type, record_id);
      res.json(successEnvelope(history, { total: history.length }));
    } catch (err) {
      next(err);
    }
  },

  async applyDecision(req, res, next) {
    try {
      const { recordType, recordId } = req.params;
      const { decision, comment } = req.body;
      const result = await approvalService.applyDecision(
        recordType.toLowerCase(),
        parseInt(recordId, 10),
        decision,
        comment,
        req.user,
        req.ip
      );
      res.json(successEnvelope(result));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = approvalController;
