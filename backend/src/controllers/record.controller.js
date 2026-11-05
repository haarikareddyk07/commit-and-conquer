const recordService = require('../services/record.service');
const { successEnvelope } = require('../utils/envelope');

function createRecordController(type) {
  return {
    async create(req, res, next) {
      try {
        const result = await recordService.createRecord(type, req.body, req.user, req.ip);
        res.status(201).json(successEnvelope(result));
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const result = await recordService.getRecord(type, req.params.id, req.user);
        res.json(successEnvelope(result));
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const result = await recordService.updateRecord(type, req.params.id, req.body, req.user, req.ip);
        res.json(successEnvelope(result));
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { rows, meta } = await recordService.listRecords(type, req.query, req.user);
        res.json(successEnvelope(rows, meta));
      } catch (err) {
        next(err);
      }
    }
  };
}

module.exports = {
  createRecordController
};
