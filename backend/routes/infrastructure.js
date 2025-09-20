/**
 * Infrastructure data routes
 * Handles mobile tower and NBN coverage data queries
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { query } = require('../utils/database');

const router = express.Router();

/**
 * GET /api/infrastructure/mobile
 * Get mobile tower locations with optional filtering
 */
router.get('/mobile', asyncHandler(async (req, res) => {
    const {
        carrier,
        technology,
        bbox,
        limit = 1000,
        offset = 0,
        include_coverage = 'false'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build dynamic WHERE clause
    if (carrier) {
        whereConditions.push(`LOWER(carrier) = LOWER($${paramIndex})`);
        queryParams.push(carrier);
        paramIndex++;
    }

    if (technology) {
        whereConditions.push(`LOWER(technology) LIKE LOWER($${paramIndex})`);
        queryParams.push(`%${technology}%`);
        paramIndex++;
    }

    // Bounding box filter (format: minLng,minLat,maxLng,maxLat)
    if (bbox) {
        const coords = bbox.split(',').map(Number);
        if (coords.length === 4) {
            whereConditions.push(`
                longitude BETWEEN $${paramIndex} AND $${paramIndex + 2} 
                AND latitude BETWEEN $${paramIndex + 1} AND $${paramIndex + 3}
            `);
            queryParams.push(...coords);
            paramIndex += 4;
        }
    }

    const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Main query for mobile sites
    const sitesQuery = `
        SELECT 
            site_id,
            carrier,
            site_name,
            technology,
            frequency_bands,
            antenna_type,
            height_agl,
            latitude,
            longitude,
            ST_AsGeoJSON(ST_Point(longitude, latitude)) as geometry,
            operational_status,
            install_date,
            last_updated
        FROM mobile_sites
        ${whereClause}
        ORDER BY site_id
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const sitesResult = await query(sitesQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
        SELECT count(*) as total_count
        FROM mobile_sites
        ${whereClause};
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset params

    // Get coverage areas if requested
    let coverageAreas = null;
    if (include_coverage === 'true') {
        let coverageWhereConditions = [];
        let coverageParams = [];
        let coverageParamIndex = 1;

        // Build coverage filters
        if (carrier) {
            coverageWhereConditions.push(`LOWER(carrier) = LOWER($${coverageParamIndex})`);
            coverageParams.push(carrier);
            coverageParamIndex++;
        }

        if (bbox) {
            const coords = bbox.split(',').map(Number);
            if (coords.length === 4) {
                coverageWhereConditions.push(`
                    geometry && ST_MakeEnvelope($${coverageParamIndex}, $${coverageParamIndex + 1}, $${coverageParamIndex + 2}, $${coverageParamIndex + 3}, 4326)
                `);
                coverageParams.push(...coords);
                coverageParamIndex += 4;
            }
        }

        const coverageWhereClause = coverageWhereConditions.length > 0 
            ? `WHERE ${coverageWhereConditions.join(' AND ')}`
            : '';

        const coverageQuery = `
            SELECT 
                id,
                carrier,
                technology,
                signal_strength,
                ST_AsGeoJSON(ST_Simplify(geometry, 0.001)) as coverage_geometry
            FROM mobile_coverage_areas
            ${coverageWhereClause}
            LIMIT 100;
        `;

        try {
            const coverageResult = await query(coverageQuery, coverageParams);
            coverageAreas = coverageResult.rows.map(area => ({
                ...area,
                coverage_geometry: JSON.parse(area.coverage_geometry)
            }));
        } catch (error) {
            console.warn('Failed to fetch coverage areas:', error.message);
        }
    }

    // Parse geometry for each site
    const sites = sitesResult.rows.map(site => ({
        ...site,
        geometry: JSON.parse(site.geometry)
    }));

    res.json({
        success: true,
        data: {
            sites,
            total_count: parseInt(countResult.rows[0].total_count),
            returned_count: sites.length,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: parseInt(offset) + sites.length < parseInt(countResult.rows[0].total_count)
            },
            filters_applied: {
                carrier,
                technology,
                bbox,
                include_coverage: include_coverage === 'true'
            },
            ...(coverageAreas && { coverage_areas: coverageAreas })
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/infrastructure/mobile/carriers
 * Get list of available carriers
 */
router.get('/mobile/carriers', asyncHandler(async (req, res) => {
    const carriersQuery = `
        SELECT 
            carrier,
            count(*) as site_count,
            array_agg(DISTINCT technology) as technologies
        FROM mobile_sites
        GROUP BY carrier
        ORDER BY carrier;
    `;

    const result = await query(carriersQuery);

    res.json({
        success: true,
        carriers: result.rows,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/infrastructure/nbn
 * Get NBN coverage areas with optional filtering
 */
router.get('/nbn', asyncHandler(async (req, res) => {
    const {
        service_type,
        technology,
        bbox,
        limit = 1000,
        offset = 0
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause for NBN data
    if (service_type) {
        whereConditions.push(`LOWER(service_type) = LOWER($${paramIndex})`);
        queryParams.push(service_type);
        paramIndex++;
    }

    if (technology) {
        whereConditions.push(`LOWER(technology) LIKE LOWER($${paramIndex})`);
        queryParams.push(`%${technology}%`);
        paramIndex++;
    }

    // Bounding box filter
    if (bbox) {
        const coords = bbox.split(',').map(Number);
        if (coords.length === 4) {
            whereConditions.push(`
                geometry && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)
            `);
            queryParams.push(...coords);
            paramIndex += 4;
        }
    }

    const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Query both wireless and fixed line coverage (without WHERE clause issues for now)
    const wirelessQuery = `
        SELECT 
            'wireless' as service_category,
            coverage_type,
            data_source,
            ST_AsGeoJSON(geometry) as geometry,
            last_updated
        FROM nbn_wireless_coverage
    `;
    
    const fixedQuery = `
        SELECT 
            'fixed' as service_category,
            coverage_type,
            data_source,
            ST_AsGeoJSON(geometry) as geometry,
            last_updated
        FROM nbn_fixed_line_coverage
    `;
    
    const nbnQuery = `
        (${wirelessQuery}) 
        UNION ALL 
        (${fixedQuery})
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    console.log('Executing NBN query:', nbnQuery);
    console.log('Query params:', queryParams);
    
    const result = await query(nbnQuery, queryParams);
    
    console.log('Query result sample:', result.rows.slice(0, 1));

    // Parse geometry for each area
    const coverageAreas = result.rows.map(area => ({
        ...area,
        geometry: area.geometry ? JSON.parse(area.geometry) : null
    }));
    
    console.log('Parsed coverage areas sample:', coverageAreas.slice(0, 1));

    res.json({
        success: true,
        data: {
            coverage_areas: coverageAreas,
            returned_count: coverageAreas.length,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            filters_applied: {
                service_type,
                technology,
                bbox
            }
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/infrastructure/nbn/test
 * Test NBN data access
 */
router.get('/nbn/test', asyncHandler(async (req, res) => {
    try {
        // Simple test query
        const testResult = await query(`
            SELECT 
                'wireless' as service_category,
                coverage_type,
                data_source,
                ST_AsGeoJSON(geometry) as geometry,
                last_updated
            FROM nbn_wireless_coverage 
            LIMIT 1
        `);
        
        res.json({
            success: true,
            test_data: testResult.rows,
            raw_geometry: testResult.rows[0]?.geometry,
            geometry_type: typeof testResult.rows[0]?.geometry,
            parsed_geometry: testResult.rows[0]?.geometry ? JSON.parse(testResult.rows[0].geometry) : null
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
}));

/**
 * GET /api/infrastructure/nbn/technologies
 * Get list of available NBN technologies
 */
router.get('/nbn/technologies', asyncHandler(async (req, res) => {
    const technologiesQuery = `
        SELECT 
            coverage_type as technology,
            count(*) as area_count,
            'wireless' as service_category,
            data_source
        FROM nbn_wireless_coverage
        GROUP BY coverage_type, data_source
        ORDER BY coverage_type;
    `;

    const result = await query(technologiesQuery);

    res.json({
        success: true,
        technologies: result.rows,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/infrastructure/summary
 * Get summary statistics for all infrastructure
 */
router.get('/summary', asyncHandler(async (req, res) => {
    // Get mobile tower stats
    const mobileSummaryQuery = `
        SELECT 
            count(*) as total_sites,
            count(DISTINCT carrier) as carrier_count,
            count(DISTINCT technology) as technology_count,
            avg(height_agl) as avg_height_agl,
            max(height_agl) as max_height_agl
        FROM mobile_sites;
    `;

    const mobileResult = await query(mobileSummaryQuery);

    // Get NBN coverage stats
    const nbnSummaryQuery = `
        SELECT 
            'wireless' as service_type,
            count(*) as area_count,
            count(DISTINCT coverage_type) as technology_count,
            count(DISTINCT data_source) as source_count
        FROM nbn_wireless_coverage;
    `;

    const nbnResult = await query(nbnSummaryQuery);

    res.json({
        success: true,
        summary: {
            mobile_infrastructure: mobileResult.rows[0],
            nbn_coverage: nbnResult.rows,
            data_freshness: {
                mobile_sites: 'Current as of data import',
                nbn_coverage: 'Current as of data import'
            }
        },
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
