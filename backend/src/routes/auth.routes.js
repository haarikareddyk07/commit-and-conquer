const express = require('express');
const authController = require('../controllers/auth.controller');
const { loginRateLimiter } = require('../middleware/rateLimiter.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { loginSchema } = require('../validators/auth.validator');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', loginRateLimiter, validateBody(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
