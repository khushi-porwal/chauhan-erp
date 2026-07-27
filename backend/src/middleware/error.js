import logger from '../config/logger.js';
import { errorResponse } from '../utils/apiResponse.js';
import { HttpError } from '../utils/errors.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;

  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.code && err.code.startsWith('P')) {
    // Prisma database error mapping
    statusCode = 400;
    message = 'Database Error';
    if (process.env.NODE_ENV === 'development') {
      errors = { code: err.code, meta: err.meta, message: err.message };
    }
    logger.error('Database Error: %o', err);
  } else {
    // Log unexpected errors
    logger.error('Unhandled error: %o', err);
    if (process.env.NODE_ENV === 'development') {
      errors = { stack: err.stack, message: err.message };
    }
  }

  return errorResponse(res, message, statusCode, errors);
};
