const uploadService = require('../services/upload.service');
const { successEnvelope } = require('../utils/envelope');
const auditService = require('../services/audit.service');

const uploadController = {
  async uploadFile(req, res, next) {
    try {
      const record = await uploadService.handleUpload(req.file, req.body, req.user.id);
      auditService.log(req.user.id, 'UPLOAD_FILE', 'uploads', record.id, req.ip);
      res.status(201).json(successEnvelope(record));
    } catch (err) {
      next(err);
    }
  },

  async getFile(req, res, next) {
    try {
      const { record, fullPath } = await uploadService.getFileMetadata(req.params.id);
      res.setHeader('Content-Type', record.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.original_name)}"`);
      res.sendFile(fullPath);
    } catch (err) {
      next(err);
    }
  }
};

module.exports = uploadController;
