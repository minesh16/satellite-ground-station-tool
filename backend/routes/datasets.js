/**
 * Dataset management routes
 * Handles listing, uploading, and managing geospatial datasets
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { query } = require('../utils/database');

const router = express.Router();

/**
 * GET /api/datasets
 * List available datasets with metadata
 */
router.get('/', asyncHandler(async (req, res) => {
    // Get all tables with spatial data
    const tablesQuery = `
        SELECT 
            t.table_name,
            NULL as description,
            pg_size_pretty(pg_total_relation_size(('public.' || t.table_name)::regclass)) as size,
            (SELECT count(*) FROM information_schema.columns 
             WHERE table_name = t.table_name 
             AND table_schema = 'public') as column_count,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM geometry_columns 
                    WHERE f_table_name = t.table_name
                ) THEN true 
                ELSE false 
            END as has_geometry
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name != 'spatial_ref_sys'
        ORDER BY t.table_name;
    `;

    const result = await query(tablesQuery);
    
    // Get row counts for each table (with error handling)
    const tablesWithCounts = await Promise.all(
        result.rows.map(async (table) => {
            try {
                // Use parameterized query to be safe, but we validated table name above
                const countResult = await query(`SELECT count(*) as row_count FROM "${table.table_name}"`);
                return {
                    ...table,
                    row_count: parseInt(countResult.rows[0].row_count)
                };
            } catch (error) {
                console.warn(`Failed to count rows for table ${table.table_name}:`, error.message);
                return {
                    ...table,
                    row_count: 0,
                    error: 'Unable to count rows'
                };
            }
        })
    );

    res.json({
        success: true,
        datasets: tablesWithCounts,
        total_datasets: tablesWithCounts.length,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/datasets/:tableName
 * Get detailed information about a specific dataset
 */
router.get('/:tableName', asyncHandler(async (req, res) => {
    const { tableName } = req.params;
    
    // Validate table name (security check)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw createError('Invalid table name format', 400);
    }

    // Check if table exists
    const tableExistsQuery = `
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        ) as exists;
    `;
    
    const existsResult = await query(tableExistsQuery, [tableName]);
    if (!existsResult.rows[0].exists) {
        throw createError('Dataset not found', 404);
    }

    // Get table metadata
    const metadataQuery = `
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
    `;

    const metadataResult = await query(metadataQuery, [tableName]);

    // Get geometry information if spatial table
    let geometryInfo = null;
    try {
        const geomQuery = `
            SELECT 
                f_geometry_column,
                coord_dimension,
                srid,
                type as geometry_type
            FROM geometry_columns
            WHERE f_table_name = $1;
        `;
        const geomResult = await query(geomQuery, [tableName]);
        if (geomResult.rows.length > 0) {
            geometryInfo = geomResult.rows[0];
        }
    } catch (error) {
        // Not a spatial table, continue without geometry info
    }

    // Get sample data (first 5 rows)
    const sampleQuery = `SELECT * FROM ${tableName} LIMIT 5`;
    const sampleResult = await query(sampleQuery);

    // Get row count
    const countQuery = `SELECT count(*) as total_rows FROM ${tableName}`;
    const countResult = await query(countQuery);

    res.json({
        success: true,
        dataset: {
            name: tableName,
            columns: metadataResult.rows,
            geometry_info: geometryInfo,
            total_rows: parseInt(countResult.rows[0].total_rows),
            sample_data: sampleResult.rows,
            is_spatial: geometryInfo !== null
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/datasets/:tableName/schema
 * Get schema information for a dataset
 */
router.get('/:tableName/schema', asyncHandler(async (req, res) => {
    const { tableName } = req.params;
    
    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw createError('Invalid table name format', 400);
    }

    // Get detailed schema information
    const schemaQuery = `
        SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            tc.constraint_type
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
            ON c.table_name = kcu.table_name 
            AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
            ON kcu.constraint_name = tc.constraint_name
        WHERE c.table_schema = 'public' 
        AND c.table_name = $1
        ORDER BY c.ordinal_position;
    `;

    const result = await query(schemaQuery, [tableName]);

    if (result.rows.length === 0) {
        throw createError('Dataset not found', 404);
    }

    res.json({
        success: true,
        table_name: tableName,
        schema: result.rows,
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/datasets/upload
 * Handle dataset upload (placeholder for future implementation)
 */
router.post('/upload', asyncHandler(async (req, res) => {
    // This is a placeholder for future file upload functionality
    // Would handle CSV, GeoJSON, Shapefile uploads
    throw createError('Dataset upload not yet implemented', 501, {
        supported_formats: ['CSV', 'GeoJSON', 'Shapefile'],
        max_file_size: '50MB',
        note: 'This feature will be implemented in a future version'
    });
}));

module.exports = router;
