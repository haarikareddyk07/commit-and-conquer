class AppError extends Error {
  constructor(code, message, statusCode = 400, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required. Please log in.') {
    super('UNAUTHENTICATED', message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super('NOT_FOUND', message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'The requested resource already exists or conflicts with current state.') {
    super('CONFLICT', message, 409);
  }
}

class ServerError extends AppError {
  constructor(message = 'An unexpected internal server error occurred.') {
    super('SERVER_ERROR', message, 500);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServerError
};
