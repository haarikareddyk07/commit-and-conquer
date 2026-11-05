const auditRepository = require('../repositories/audit.repository');

const auditService = {
  log(userId, action, entity, entityId = null, ipAddress = null) {
    try {
      auditRepository.log(userId, action, entity, entityId, ipAddress);
    } catch (err) {
      console.error('Audit log failed:', err.message);
    }
  }
};

module.exports = auditService;
