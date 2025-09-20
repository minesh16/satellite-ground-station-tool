/**
 * Database connection pool and utility functions
 * Handles PostgreSQL/PostGIS connections for the SGS API
 */

const { Pool } = require('pg');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sgs',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // Connection timeout
};

// Create connection pool
const pool = new Pool(dbConfig);

// Pool error handling
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Execute a query with automatic connection handling
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const start = Date.now();
    
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        console.log('Executed query:', {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: `${duration}ms`,
            rows: res.rowCount
        });
        
        return res;
    } catch (error) {
        console.error('Database query error:', {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            error: error.message
        });
        throw error;
    }
}

/**
 * Get a client from the pool for transaction handling
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
    return await pool.connect();
}

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
    try {
        const result = await query('SELECT NOW() as current_time');
        console.log('Database connection test successful:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error.message);
        return false;
    }
}

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
async function closePool() {
    await pool.end();
    console.log('Database connection pool closed');
}

/**
 * Check if PostGIS extension is available
 * @returns {Promise<boolean>} PostGIS availability
 */
async function checkPostGIS() {
    try {
        const result = await query(`
            SELECT EXISTS(
                SELECT 1 FROM pg_extension WHERE extname = 'postgis'
            ) as postgis_installed
        `);
        return result.rows[0].postgis_installed;
    } catch (error) {
        console.error('Error checking PostGIS:', error.message);
        return false;
    }
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
async function getDbStats() {
    try {
        const tablesQuery = `
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        `;
        
        const tables = await query(tablesQuery);
        
        const connectionQuery = `
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity 
            WHERE datname = current_database();
        `;
        
        const connections = await query(connectionQuery);
        
        return {
            tables: tables.rows,
            connections: connections.rows[0],
            pool_size: pool.totalCount,
            pool_idle: pool.idleCount,
            pool_waiting: pool.waitingCount
        };
    } catch (error) {
        console.error('Error getting database stats:', error.message);
        return null;
    }
}

module.exports = {
    pool,
    query,
    getClient,
    testConnection,
    closePool,
    checkPostGIS,
    getDbStats
};
