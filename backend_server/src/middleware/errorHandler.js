const logger = require('../config/logger');
const { errorResponse } = require('../utils/response');

/**
 * Global error handling middleware
 * Catches all errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
    // Log the full error
    logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Default error status and message
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.code === '23505') { // PostgreSQL unique violation
        statusCode = 409;
        message = 'Resource already exists';
    } else if (err.code === '23503') { // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
    }

    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal server error';
    }

    return errorResponse(res, message, statusCode, err.errors);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    logger.warn('Route not found:', { path: req.path, method: req.method });
    return errorResponse(res, 'Route not found', 404);
};

module.exports = {
    errorHandler,
    notFoundHandler
};
