/**
 * Global error handling middleware for Express
 * Provides consistent error responses and logging
 */

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
    // Default error details
    let status = 500;
    let message = 'Internal Server Error';
    let details = null;

    // Log the error
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        status = 400;
        message = 'Validation Error';
        details = err.details || err.message;
    } else if (err.code && err.code.startsWith('23')) {
        // PostgreSQL constraint violations
        status = 400;
        message = 'Database Constraint Error';
        details = 'Data integrity constraint violated';
    } else if (err.code === '42P01') {
        // PostgreSQL table/relation does not exist
        status = 500;
        message = 'Database Schema Error';
        details = 'Required database table not found';
    } else if (err.code === '28P01') {
        // PostgreSQL authentication failed
        status = 500;
        message = 'Database Connection Error';
        details = 'Database authentication failed';
    } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
        // JSON parsing error
        status = 400;
        message = 'Invalid JSON';
        details = 'Request body contains invalid JSON';
    } else if (err.status) {
        // Custom status errors
        status = err.status;
        message = err.message;
        details = err.details;
    } else if (process.env.NODE_ENV === 'development') {
        // In development, show more details
        message = err.message;
        details = err.stack;
    }

    // Send error response
    res.status(status).json({
        error: true,
        message,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
            path: req.path,
            method: req.method 
        })
    });
}

/**
 * Create a custom error with status
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {*} details - Additional error details
 * @returns {Error} Custom error object
 */
function createError(message, status = 500, details = null) {
    const error = new Error(message);
    error.status = status;
    error.details = details;
    return error;
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    createError,
    asyncHandler
};
