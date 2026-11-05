const express = require('express');
const alertController = require('../controllers/alert.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', alertController.listAlerts);
router.get('/:id', alertController.getAlert);
router.post('/:id/review', authorize('SUPERVISOR', 'MANAGER'), alertController.reviewAlert);

module.exports = router;
