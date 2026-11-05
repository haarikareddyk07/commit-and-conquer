const app = require('./app');
const config = require('./config/env');
const { logger } = require('./utils/logger');
const { getDatabase } = require('./config/database');

// Ensure database connection
try {
  const db = getDatabase();
  logger.info('Database connection initialised successfully.');
} catch (err) {
  logger.error('Failed to initialize database connection:', { error: err.message });
  process.exit(1);
}

const server = app.listen(config.port, () => {
  logger.info(`SmartTrust REST API running on port ${config.port} [NODE_ENV=${config.nodeEnv}]`);
  logger.info(`API Base Path: http://localhost:${config.port}/api/v1`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = server;
