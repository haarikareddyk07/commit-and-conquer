const approvalRepository = require('../repositories/approval.repository');
const auditService = require('./audit.service');
const analytics = require('../analytics');
const { getDatabase } = require('../config/database');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

const approvalService = {
  async getPendingQueue(user, query) {
    if (user.role === 'EMPLOYEE') {
      throw new ForbiddenError('Employees do not have access to the approval queue.');
    }
    return approvalRepository.findPendingQueue(user, query);
  },

  async getHistory(recordType, recordId) {
    return approvalRepository.getHistory(recordType, recordId);
  },

  async applyDecision(recordType, recordId, decision, comment, user, ipAddress) {
    if (user.role === 'EMPLOYEE') {
      throw new ForbiddenError('Employees cannot approve or reject records.');
    }

    const validTypes = ['energy', 'hygiene', 'production', 'waste'];
    if (!validTypes.includes(recordType)) {
      throw new ValidationError(`Invalid record type: ${recordType}`);
    }

    // Check if record exists
    const db = getDatabase();
    const tableMap = {
      energy: 'energy_records',
      hygiene: 'hygiene_records',
      production: 'production_records',
      waste: 'waste_records'
    };
    const row = db.prepare(`SELECT * FROM ${tableMap[recordType]} WHERE id = ?`).get(recordId);
    if (!row) {
      throw new NotFoundError(`${recordType} record with ID ${recordId} not found.`);
    }

    // Supervisor department check
    if (user.role === 'SUPERVISOR') {
      let deptId = null;
      if (recordType === 'energy') {
        const m = db.prepare('SELECT department_id FROM machines WHERE id = ?').get(row.machine_id);
        deptId = m ? m.department_id : null;
      } else if (recordType === 'hygiene') {
        const a = db.prepare('SELECT department_id FROM areas WHERE id = ?').get(row.area_id);
        deptId = a ? a.department_id : null;
      } else {
        const u = db.prepare('SELECT department_id FROM users WHERE id = ?').get(row.entered_by);
        deptId = u ? u.department_id : null;
      }

      if (deptId && user.departmentId && deptId !== user.departmentId) {
        throw new ForbiddenError('You can only review records from your department.');
      }
    }

    // Apply decision inside one transaction
    const updated = approvalRepository.applyDecision(
      recordType,
      recordId,
      decision,
      user.id,
      comment
    );

    auditService.log(
      user.id,
      `APPROVAL_DECISION_${decision}`,
      `${recordType}_records`,
      recordId,
      ipAddress
    );

    // After APPROVE, call analytics to recompute baselines and evaluate the record
    if (decision === 'APPROVE') {
      try {
        if (recordType === 'energy') {
          analytics.recomputeAllBaselines(db);
          analytics.evaluateEnergyRecord(db, recordId);
        } else if (recordType === 'hygiene') {
          analytics.evaluateHygieneRecord(db, recordId);
        } else if (recordType === 'production') {
          analytics.evaluateProduction(db, recordId);
        }
      } catch (analyticsErr) {
        console.error('Analytics post-approval processing failed:', analyticsErr.message);
      }
    }

    return updated;
  }
};

module.exports = approvalService;
