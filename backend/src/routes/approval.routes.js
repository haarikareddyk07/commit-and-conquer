const express = require('express');
const approvalController = require('../controllers/approval.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { approvalDecisionSchema } = require('../validators/approval.validator');

const router = express.Router();
router.use(authenticate);

router.get('/pending', authorize('SUPERVISOR', 'MANAGER'), approvalController.getPendingQueue);
router.post(
  '/:recordType/:recordId/decision',
  authorize('SUPERVISOR', 'MANAGER'),
  validateBody(approvalDecisionSchema),
  approvalController.applyDecision
);
router.get('/history', approvalController.getHistory);

module.exports = router;
