const express = require('express');
const { createRecordController } = require('../controllers/record.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../middleware/validate.middleware');
const {
  energyRecordSchema,
  energyRecordUpdateSchema,
  hygieneRecordSchema,
  hygieneRecordUpdateSchema,
  productionRecordSchema,
  productionRecordUpdateSchema,
  wasteRecordSchema,
  wasteRecordUpdateSchema
} = require('../validators/record.validator');
const { paginationQuerySchema } = require('../validators/query.validator');

function createRecordRouter(type, schema, updateSchema) {
  const router = express.Router();
  const controller = createRecordController(type);

  router.use(authenticate);

  router.get('/', validateQuery(paginationQuerySchema), controller.list);
  router.post('/', validateBody(schema), controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', validateBody(updateSchema), controller.update);

  return router;
}

const energyRouter = createRecordRouter('energy', energyRecordSchema, energyRecordUpdateSchema);
const hygieneRouter = createRecordRouter('hygiene', hygieneRecordSchema, hygieneRecordUpdateSchema);
const productionRouter = createRecordRouter('production', productionRecordSchema, productionRecordUpdateSchema);
const wasteRouter = createRecordRouter('waste', wasteRecordSchema, wasteRecordUpdateSchema);

module.exports = {
  energyRouter,
  hygieneRouter,
  productionRouter,
  wasteRouter
};
