const alertRepository = require('../repositories/alert.repository');
const { successEnvelope } = require('../utils/envelope');
const { NotFoundError, ValidationError } = require('../utils/errors');
const auditService = require('../services/audit.service');

const alertController = {
  listAlerts(req, res, next) {
    try {
      const { rows, total } = alertRepository.findAll(req.query);
      const parsed = rows.map(r => ({
        ...r,
        evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null
      }));
      res.json(successEnvelope(parsed, {
        total,
        page: req.query.page || 1,
        pageSize: req.query.pageSize || 20
      }));
    } catch (err) {
      next(err);
    }
  },

  getAlert(req, res, next) {
    try {
      const alert = alertRepository.findById(req.params.id);
      if (!alert) throw new NotFoundError('Alert not found');
      res.json(successEnvelope({
        ...alert,
        evidence: alert.evidence_json ? JSON.parse(alert.evidence_json) : null
      }));
    } catch (err) {
      next(err);
    }
  },

  reviewAlert(req, res, next) {
    try {
      const { status, comment } = req.body;
      const validStatuses = ['UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Status must be one of UNDER_REVIEW, CONFIRMED, or DISMISSED');
      }

      const alert = alertRepository.findById(req.params.id);
      if (!alert) throw new NotFoundError('Alert not found');

      const updated = alertRepository.review(req.params.id, status, comment, req.user.id);
      auditService.log(req.user.id, `REVIEW_ALERT_${status}`, 'alerts', req.params.id, req.ip);

      res.json(successEnvelope({
        ...updated,
        evidence: updated.evidence_json ? JSON.parse(updated.evidence_json) : null
      }));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = alertController;
