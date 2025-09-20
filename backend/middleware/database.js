/**
 * Database middleware for Express routes
 * Provides database connection pool access to all routes
 */

const { pool, testConnection } = require('../utils/database');

/**
 * Middleware to attach database pool to request object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function dbMiddleware(req, res, next) {
    // Attach database pool to request object
    req.dbPool = pool;
    req.db = {
        query: pool.query.bind(pool),
        getClient: pool.connect.bind(pool)
    };
    
    next();
}

module.exports = dbMiddleware;
