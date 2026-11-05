const energyRepository = require('../repositories/energy.repository');
const hygieneRepository = require('../repositories/hygiene.repository');
const productionRepository = require('../repositories/production.repository');
const wasteRepository = require('../repositories/waste.repository');
const approvalRepository = require('../repositories/approval.repository');
const auditService = require('./audit.service');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

const repoMap = {
  energy: energyRepository,
  hygiene: hygieneRepository,
  production: productionRepository,
  waste: wasteRepository
};

const recordService = {
  getRepository(type) {
    const repo = repoMap[type];
    if (!repo) throw new ValidationError(`Invalid record type: ${type}`);
    return repo;
  },

  async createRecord(type, data, user, ipAddress) {
    const repo = this.getRepository(type);
    data.entered_by = user.id;

    const record = repo.create(data);

    // Write approval_history row with action SUBMITTED
    approvalRepository.addHistory(type, record.id, 'SUBMITTED', user.id, 'Initial record submission');

    auditService.log(user.id, `CREATE_${type.toUpperCase()}_RECORD`, `${type}_records`, record.id, ipAddress);
    return record;
  },

  async getRecord(type, id, user) {
    const repo = this.getRepository(type);
    const record = repo.findById(id);
    if (!record) {
      throw new NotFoundError(`${type.charAt(0).toUpperCase() + type.slice(1)} record with ID ${id} not found.`);
    }

    // Permissions check
    if (user.role === 'EMPLOYEE' && record.entered_by !== user.id) {
      throw new ForbiddenError('You can only access records entered by yourself.');
    }
    if (user.role === 'SUPERVISOR') {
      const recordDept = record.department_id || (record.area_department_id || null);
      if (recordDept && user.departmentId && recordDept !== user.departmentId) {
        throw new ForbiddenError('You can only access records within your department.');
      }
    }

    // Attach approval history
    const history = approvalRepository.getHistory(type, id);
    return { ...record, approval_history: history };
  },

  async updateRecord(type, id, fields, user, ipAddress) {
    const repo = this.getRepository(type);
    const existing = repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`${type.charAt(0).toUpperCase() + type.slice(1)} record with ID ${id} not found.`);
    }

    // Rule: "PUT /…/:id only while status is PENDING or CORRECTION_REQUESTED and only by the author"
    if (existing.entered_by !== user.id && user.role !== 'MANAGER') {
      throw new ForbiddenError('Only the author can update this record.');
    }

    if (existing.status !== 'PENDING' && existing.status !== 'CORRECTION_REQUESTED') {
      throw new ValidationError(`Cannot update record with status "${existing.status}". Only PENDING or CORRECTION_REQUESTED records may be edited.`);
    }

    const wasCorrectionRequested = existing.status === 'CORRECTION_REQUESTED';
    if (wasCorrectionRequested) {
      fields.status = 'PENDING';
    }

    const updated = repo.update(id, fields);

    // Rule: "Corrected records re-enter as PENDING with action RESUBMITTED"
    if (wasCorrectionRequested) {
      approvalRepository.addHistory(type, id, 'RESUBMITTED', user.id, fields.notes || 'Corrected and resubmitted for review');
    }

    auditService.log(user.id, `UPDATE_${type.toUpperCase()}_RECORD`, `${type}_records`, id, ipAddress);
    return updated;
  },

  async listRecords(type, query, user) {
    const repo = this.getRepository(type);
    const { rows, total } = repo.findAll({ user, ...query });
    return {
      rows,
      meta: {
        total,
        page: query.page || 1,
        pageSize: query.pageSize || 20
      }
    };
  }
};

module.exports = recordService;
