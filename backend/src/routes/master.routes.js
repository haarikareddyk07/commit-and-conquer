const express = require('express');
const masterController = require('../controllers/master.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  machineSchema,
  areaSchema,
  scheduleSchema,
  scheduleUpdateSchema,
  productSchema,
  materialSchema,
  departmentSchema
} = require('../validators/master.validator');

const router = express.Router();
router.use(authenticate);

// Departments
router.get('/departments', masterController.getDepartments);
router.post('/departments', authorize('MANAGER'), validateBody(departmentSchema), masterController.createDepartment);

// Machines
router.get('/machines', masterController.getMachines);
router.get('/machines/:id', masterController.getMachineById);
router.post('/machines', authorize('MANAGER'), validateBody(machineSchema), masterController.createMachine);
router.put('/machines/:id', authorize('MANAGER'), validateBody(machineSchema.partial()), masterController.updateMachine);

// Areas
router.get('/areas', masterController.getAreas);
router.get('/areas/:id', masterController.getAreaById);
router.post('/areas', authorize('MANAGER'), validateBody(areaSchema), masterController.createArea);
router.put('/areas/:id', authorize('MANAGER'), validateBody(areaSchema.partial()), masterController.updateArea);

// Sanitation Schedules
router.get('/sanitation-schedules', masterController.getSchedules);
router.get('/sanitation-schedules/:id', masterController.getScheduleById);
router.post('/sanitation-schedules', authorize('MANAGER'), validateBody(scheduleSchema), masterController.createSchedule);
router.put('/sanitation-schedules/:id', authorize('MANAGER'), validateBody(scheduleUpdateSchema), masterController.updateSchedule);

// Products
router.get('/products', masterController.getProducts);
router.get('/products/:id', masterController.getProductById);
router.post('/products', authorize('MANAGER'), validateBody(productSchema), masterController.createProduct);
router.put('/products/:id', authorize('MANAGER'), validateBody(productSchema.partial()), masterController.updateProduct);

// Materials
router.get('/materials', masterController.getMaterials);
router.get('/materials/:id', masterController.getMaterialById);
router.post('/materials', authorize('MANAGER'), validateBody(materialSchema), masterController.createMaterial);
router.put('/materials/:id', authorize('MANAGER'), validateBody(materialSchema.partial()), masterController.updateMaterial);

module.exports = router;
