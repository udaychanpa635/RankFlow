'use strict';

const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode  = statusCode;
    this.status      = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors      = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(errors) { super('Validation failed', 422, errors); }
}
class AuthError extends AppError {
  constructor(msg = 'Authentication failed') { super(msg, 401); }
}
class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404); }
}
class ConflictError extends AppError {
  constructor(msg = 'Resource already exists') { super(msg, 409); }
}

function handleMongoError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new ConflictError(`${field} already exists`);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ValidationError(errors);
  }
  if (err.name === 'CastError') return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  return err;
}

function errorHandler(err, req, res, next) {
  let error = err;
  if (['MongoServerError','ValidationError','CastError'].includes(err.name)) error = handleMongoError(err);
  if (err.name === 'JsonWebTokenError')  error = new AuthError('Invalid token');
  if (err.name === 'TokenExpiredError')  error = new AuthError('Token expired');

  const statusCode = error.statusCode || 500;
  const message    = error.isOperational ? error.message : 'Internal server error';

  if (!error.isOperational || statusCode >= 500) {
    logger.error('Error:', { message: err.message, url: req.url, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    status:  error.status || 'error',
    message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.originalUrl}`));
}

module.exports = { AppError, ValidationError, AuthError, NotFoundError, ConflictError, errorHandler, notFoundHandler };
