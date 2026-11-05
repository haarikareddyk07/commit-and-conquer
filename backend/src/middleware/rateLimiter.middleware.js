const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { errorEnvelope } = require('../utils/envelope');

const loginRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // 15 mins default
  max: config.rateLimitMaxAttempts, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      errorEnvelope(
        'VALIDATION_ERROR',
        'Too many failed login attempts. Please wait 15 minutes before trying again.'
      )
    );
  }
});

module.exports = {
  loginRateLimiter
};
