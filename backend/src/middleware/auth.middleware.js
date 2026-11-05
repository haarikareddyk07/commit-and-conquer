const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { UnauthenticatedError, ForbiddenError } = require('../utils/errors');
const userRepository = require('../repositories/user.repository');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthenticatedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = userRepository.findById(payload.userId);

    if (!user || !user.is_active) {
      return next(new UnauthenticatedError('User account not found or deactivated'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      departmentId: user.department_id
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthenticatedError('Session token has expired. Please log in again.'));
    }
    return next(new UnauthenticatedError('Invalid session token.'));
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthenticatedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied: Requires role ${allowedRoles.join(' or ')}`));
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
