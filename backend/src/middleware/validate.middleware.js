const { ValidationError } = require('../utils/errors');

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return next(new ValidationError(details[0]?.message || 'Validation failed', details));
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return next(new ValidationError(details[0]?.message || 'Invalid query parameters', details));
    }
    req.query = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};
