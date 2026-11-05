const masterRepository = require('../repositories/master.repository');
const { successEnvelope } = require('../utils/envelope');
const { NotFoundError } = require('../utils/errors');
const auditService = require('../services/audit.service');

const masterController = {
  // Departments
  getDepartments(req, res, next) {
    try {
      const data = masterRepository.getDepartments();
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createDepartment(req, res, next) {
    try {
      const data = masterRepository.createDepartment(req.body.name);
      auditService.log(req.user.id, 'CREATE_DEPARTMENT', 'departments', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },

  // Machines
  getMachines(req, res, next) {
    try {
      const data = masterRepository.getMachines(req.query.department_id);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  getMachineById(req, res, next) {
    try {
      const data = masterRepository.getMachineById(req.params.id);
      if (!data) throw new NotFoundError('Machine not found');
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createMachine(req, res, next) {
    try {
      const data = masterRepository.createMachine(req.body);
      auditService.log(req.user.id, 'CREATE_MACHINE', 'machines', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  updateMachine(req, res, next) {
    try {
      const data = masterRepository.updateMachine(req.params.id, req.body);
      if (!data) throw new NotFoundError('Machine not found');
      auditService.log(req.user.id, 'UPDATE_MACHINE', 'machines', data.id, req.ip);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },

  // Areas
  getAreas(req, res, next) {
    try {
      const data = masterRepository.getAreas(req.query.department_id);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  getAreaById(req, res, next) {
    try {
      const data = masterRepository.getAreaById(req.params.id);
      if (!data) throw new NotFoundError('Area not found');
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createArea(req, res, next) {
    try {
      const data = masterRepository.createArea(req.body);
      auditService.log(req.user.id, 'CREATE_AREA', 'areas', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  updateArea(req, res, next) {
    try {
      const data = masterRepository.updateArea(req.params.id, req.body);
      if (!data) throw new NotFoundError('Area not found');
      auditService.log(req.user.id, 'UPDATE_AREA', 'areas', data.id, req.ip);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },

  // Schedules
  getSchedules(req, res, next) {
    try {
      const data = masterRepository.getSchedules(req.query.area_id);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  getScheduleById(req, res, next) {
    try {
      const data = masterRepository.getScheduleById(req.params.id);
      if (!data) throw new NotFoundError('Sanitation schedule not found');
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createSchedule(req, res, next) {
    try {
      const data = masterRepository.createSchedule(req.body);
      auditService.log(req.user.id, 'CREATE_SCHEDULE', 'sanitation_schedules', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  updateSchedule(req, res, next) {
    try {
      const data = masterRepository.updateSchedule(req.params.id, req.body);
      if (!data) throw new NotFoundError('Sanitation schedule not found');
      auditService.log(req.user.id, 'UPDATE_SCHEDULE', 'sanitation_schedules', data.id, req.ip);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },

  // Products
  getProducts(req, res, next) {
    try {
      const data = masterRepository.getProducts();
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  getProductById(req, res, next) {
    try {
      const data = masterRepository.getProductById(req.params.id);
      if (!data) throw new NotFoundError('Product not found');
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createProduct(req, res, next) {
    try {
      const data = masterRepository.createProduct(req.body);
      auditService.log(req.user.id, 'CREATE_PRODUCT', 'products', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  updateProduct(req, res, next) {
    try {
      const data = masterRepository.updateProduct(req.params.id, req.body);
      if (!data) throw new NotFoundError('Product not found');
      auditService.log(req.user.id, 'UPDATE_PRODUCT', 'products', data.id, req.ip);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },

  // Materials
  getMaterials(req, res, next) {
    try {
      const data = masterRepository.getMaterials();
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  getMaterialById(req, res, next) {
    try {
      const data = masterRepository.getMaterialById(req.params.id);
      if (!data) throw new NotFoundError('Material not found');
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  createMaterial(req, res, next) {
    try {
      const data = masterRepository.createMaterial(req.body);
      auditService.log(req.user.id, 'CREATE_MATERIAL', 'materials', data.id, req.ip);
      res.status(201).json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  },
  updateMaterial(req, res, next) {
    try {
      const data = masterRepository.updateMaterial(req.params.id, req.body);
      if (!data) throw new NotFoundError('Material not found');
      auditService.log(req.user.id, 'UPDATE_MATERIAL', 'materials', data.id, req.ip);
      res.json(successEnvelope(data));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = masterController;
