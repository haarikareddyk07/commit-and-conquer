const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/summary', dashboardController.getSummary);
router.get('/energy-trend', dashboardController.getEnergyTrend);
router.get('/hygiene-compliance', dashboardController.getHygieneCompliance);
router.get('/waste-summary', dashboardController.getWasteSummary);

module.exports = router;
