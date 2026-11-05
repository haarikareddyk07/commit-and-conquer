const express = require('express');
const insightController = require('../controllers/insight.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/recommendations', insightController.getRecommendations);

module.exports = router;
