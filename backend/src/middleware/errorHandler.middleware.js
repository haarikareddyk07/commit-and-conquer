const { AppError } = require('../utils/errors');
const { errorEnvelope } = require('../utils/envelope');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle known AppError instances
  if (err instanceof AppError) {
    logger.warn(`Operational Error: [${err.code}] ${err.message}`, {
      code: err.code,
      path: req.path,
      method: req.method,
      details: err.details
    });

    return res.status(err.statusCode).json(
      errorEnvelope(err.code, err.message, err.details)
    );
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size of 10 MB.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field in upload request.';
    }
    return res.status(400).json(
      errorEnvelope('VALIDATION_ERROR', message, [{ field: err.field || 'file', message }])
    );
  }

  // Handle SQLite constraint violations
  if (err.message && (err.message.includes('CHECK constraint failed') || err.message.includes('NOT NULL constraint failed'))) {
    return res.status(400).json(
      errorEnvelope('VALIDATION_ERROR', `Data constraint violation: ${err.message}`)
    );
  }

  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json(
      errorEnvelope('CONFLICT', 'A record with this identifier already exists.')
    );
  }

  // Unhandled / server errors
  logger.error(`Internal Server Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  return res.status(500).json(
    errorEnvelope('SERVER_ERROR', 'An unexpected internal server error occurred.')
  );
}

module.exports = errorHandler;
