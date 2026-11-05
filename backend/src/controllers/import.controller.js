const importService = require('../services/import.service');
const { successEnvelope } = require('../utils/envelope');
const { ValidationError } = require('../utils/errors');

const importController = {
  preview(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError('A file (.csv or .xlsx) is required for import preview.');
      }
      const type = (req.body.type || req.query.type || '').toLowerCase();
      if (!type) {
        throw new ValidationError('Import type (energy, production, or waste) is required.');
      }

      const previewData = importService.preview(type, req.file.buffer, req.file.originalname);
      res.json(successEnvelope(previewData));
    } catch (err) {
      next(err);
    }
  },

  async commit(req, res, next) {
    try {
      const type = (req.body.type || '').toLowerCase();
      const rows = req.body.rows;
      if (!type || !rows) {
        throw new ValidationError('Both "type" and "rows" array are required to commit imported records.');
      }

      const result = await importService.commit(type, rows, req.user, req.ip);
      res.json(successEnvelope(result));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = importController;
