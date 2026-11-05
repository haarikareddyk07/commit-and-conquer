const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../middleware/validate.middleware');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');
const { paginationQuerySchema } = require('../validators/query.validator');

const router = express.Router();
router.use(authenticate, authorize('MANAGER'));

router.get('/', validateQuery(paginationQuerySchema), userController.listUsers);
router.get('/:id', userController.getUser);
router.post('/', validateBody(createUserSchema), userController.createUser);
router.put('/:id', validateBody(updateUserSchema), userController.updateUser);

module.exports = router;
