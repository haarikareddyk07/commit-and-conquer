const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'smarttrust_default_secret_key_change_in_production',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../../database/smarttrust.db'),
  uploadDir: process.env.UPLOAD_DIR 
    ? (path.isAbsolute(process.env.UPLOAD_DIR) ? process.env.UPLOAD_DIR : path.resolve(__dirname, '../../', process.env.UPLOAD_DIR))
    : path.resolve(__dirname, '../../uploads'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
};

module.exports = config;
