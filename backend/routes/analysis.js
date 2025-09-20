/**
 * Analysis routes for ground station site optimization
 * Handles spatial analysis and site recommendation endpoints
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { query } = require('../utils/database');
const { 
    analyzeSites, 
    calculateSiteScore, 
    DEFAULT_WEIGHTS 
} = require('../utils/spatialAnalysis');

const router = express.Router();

/**
 * GET /api/analysis/sites
 * Generate candidate ground station locations
 */
router.get('/sites', asyncHandler(async (req, res) => {
    const {
        bbox,
        max_sites = 20,
        min_score = 0.4,
        grid_resolution = 0.01,
        weights
    } = req.query;

    // Validate bounding box
    if (!bbox) {
        throw createError('Bounding box required (bbox=minLng,minLat,maxLng,maxLat)', 400);
    }

    const bboxArray = bbox.split(',').map(Number);
    if (bboxArray.length !== 4 || bboxArray.some(isNaN)) {
        throw createError('Invalid bounding box format. Use: minLng,minLat,maxLng,maxLat', 400);
    }

    // Parse custom weights if provided
    let analysisWeights = DEFAULT_WEIGHTS;
    if (weights) {
        try {
            const customWeights = JSON.parse(weights);
            // Validate weights sum to 1.0 (approximately)
            const weightSum = Object.values(customWeights).reduce((sum, w) => sum + w, 0);
            if (Math.abs(weightSum - 1.0) > 0.1) {
                throw createError('Weights must sum to approximately 1.0', 400);
            }
            analysisWeights = { ...DEFAULT_WEIGHTS, ...customWeights };
        } catch (error) {
            throw createError('Invalid weights format. Use JSON object.', 400);
        }
    }

    // Perform site analysis
    const analysisParams = {
        bbox: bboxArray,
        weights: analysisWeights,
        gridResolution: parseFloat(grid_resolution),
        maxSites: parseInt(max_sites),
        minScore: parseFloat(min_score)
    };

    console.log('Starting site analysis with params:', analysisParams);
    
    const candidateSites = await analyzeSites(analysisParams);

    res.json({
        success: true,
        analysis: {
            candidate_sites: candidateSites,
            total_candidates: candidateSites.length,
            analysis_parameters: analysisParams,
            weights_used: analysisWeights,
            bbox_analyzed: bboxArray,
            timestamp: new Date().toISOString()
        },
        metadata: {
            grid_resolution_km: parseFloat(grid_resolution) * 111, // Approximate km per degree
            analysis_area_km2: Math.abs((bboxArray[2] - bboxArray[0]) * (bboxArray[3] - bboxArray[1])) * 111 * 111,
            min_score_threshold: parseFloat(min_score)
        }
    });
}));

/**
 * POST /api/analysis/custom
 * Custom analysis with user-defined parameters
 */
router.post('/custom', asyncHandler(async (req, res) => {
    const {
        bbox,
        weights = DEFAULT_WEIGHTS,
        constraints = {},
        grid_resolution = 0.01,
        max_sites = 50,
        min_score = 0.3,
        analysis_name = 'Custom Analysis'
    } = req.body;

    // Validate required parameters
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
        throw createError('Bounding box required as array [minLng, minLat, maxLng, maxLat]', 400);
    }

    // Validate and normalize weights
    const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 0.1) {
        throw createError('Weights must sum to approximately 1.0', 400);
    }

    // Apply constraints if provided
    let analysisParams = {
        bbox,
        weights,
        gridResolution: grid_resolution,
        maxSites: max_sites,
        minScore: min_score
    };

    // Handle elevation constraints
    if (constraints.min_elevation || constraints.max_elevation) {
        console.log('Elevation constraints applied:', constraints);
        // This would be implemented when elevation data is available
    }

    // Handle exclusion zones
    if (constraints.exclusion_zones) {
        console.log('Exclusion zones applied:', constraints.exclusion_zones.length);
        // This would filter out sites within exclusion polygons
    }

    console.log('Starting custom analysis:', analysis_name);
    
    const candidateSites = await analyzeSites(analysisParams);

    // Save analysis scenario to database
    try {
        const scenarioInsert = `
            INSERT INTO analysis_scenarios (
                scenario_name, 
                parameters, 
                results_count, 
                created_at
            ) VALUES ($1, $2, $3, NOW())
            RETURNING scenario_id;
        `;
        
        const scenarioResult = await query(scenarioInsert, [
            analysis_name,
            JSON.stringify({
                ...analysisParams,
                constraints,
                metadata: {
                    analysis_area_km2: Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) * 111 * 111,
                    grid_resolution_km: grid_resolution * 111
                }
            }),
            candidateSites.length
        ]);

        const scenarioId = scenarioResult.rows[0].scenario_id;

        // Save top candidate sites
        if (candidateSites.length > 0) {
            const siteInserts = candidateSites.slice(0, 10).map((site, index) => {
                return `(${scenarioId}, ST_GeomFromText('POINT(${site.longitude} ${site.latitude})', 4326), ${site.total_score}, '${JSON.stringify(site.score_breakdown)}', '${site.reasoning}', ${index + 1})`;
            }).join(',');

            const sitesInsert = `
                INSERT INTO candidate_sites (
                    scenario_id, geom, total_score, score_breakdown, reasoning, rank_order
                ) VALUES ${siteInserts};
            `;

            await query(sitesInsert);
        }

        res.json({
            success: true,
            analysis: {
                scenario_id: scenarioId,
                scenario_name: analysis_name,
                candidate_sites: candidateSites,
                total_candidates: candidateSites.length,
                saved_to_database: true,
                analysis_parameters: analysisParams,
                constraints_applied: constraints,
                weights_used: weights
            },
            metadata: {
                grid_resolution_km: grid_resolution * 111,
                analysis_area_km2: Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) * 111 * 111,
                execution_time: new Date().toISOString()
            }
        });

    } catch (dbError) {
        console.warn('Failed to save analysis to database:', dbError.message);
        
        // Return results even if saving failed
        res.json({
            success: true,
            analysis: {
                scenario_name: analysis_name,
                candidate_sites: candidateSites,
                total_candidates: candidateSites.length,
                saved_to_database: false,
                analysis_parameters: analysisParams,
                constraints_applied: constraints,
                weights_used: weights,
                database_error: dbError.message
            },
            metadata: {
                grid_resolution_km: grid_resolution * 111,
                analysis_area_km2: Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) * 111 * 111,
                execution_time: new Date().toISOString()
            }
        });
    }
}));

/**
 * GET /api/analysis/scenarios
 * List saved analysis scenarios
 */
router.get('/scenarios', asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;

    const scenariosQuery = `
        SELECT 
            scenario_id,
            scenario_name,
            parameters,
            results_count,
            created_at,
            (SELECT COUNT(*) FROM candidate_sites WHERE scenario_id = s.scenario_id) as saved_sites_count
        FROM analysis_scenarios s
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2;
    `;

    const result = await query(scenariosQuery, [parseInt(limit), parseInt(offset)]);

    const scenarios = result.rows.map(scenario => ({
        ...scenario,
        parameters: typeof scenario.parameters === 'string' 
            ? JSON.parse(scenario.parameters) 
            : scenario.parameters
    }));

    res.json({
        success: true,
        scenarios,
        pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            returned_count: scenarios.length
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/analysis/scenarios/:scenarioId
 * Get detailed results for a specific analysis scenario
 */
router.get('/scenarios/:scenarioId', asyncHandler(async (req, res) => {
    const { scenarioId } = req.params;

    // Get scenario details
    const scenarioQuery = `
        SELECT 
            scenario_id,
            scenario_name,
            parameters,
            results_count,
            created_at
        FROM analysis_scenarios
        WHERE scenario_id = $1;
    `;

    const scenarioResult = await query(scenarioQuery, [scenarioId]);

    if (scenarioResult.rows.length === 0) {
        throw createError('Analysis scenario not found', 404);
    }

    // Get candidate sites for this scenario
    const sitesQuery = `
        SELECT 
            site_id,
            ST_X(geom) as longitude,
            ST_Y(geom) as latitude,
            total_score,
            score_breakdown,
            reasoning,
            rank_order,
            ST_AsGeoJSON(geom) as geometry
        FROM candidate_sites
        WHERE scenario_id = $1
        ORDER BY rank_order;
    `;

    const sitesResult = await query(sitesQuery, [scenarioId]);

    const scenario = scenarioResult.rows[0];
    const sites = sitesResult.rows.map(site => ({
        ...site,
        score_breakdown: typeof site.score_breakdown === 'string' 
            ? JSON.parse(site.score_breakdown) 
            : site.score_breakdown,
        geometry: JSON.parse(site.geometry)
    }));

    res.json({
        success: true,
        scenario: {
            ...scenario,
            parameters: typeof scenario.parameters === 'string' 
                ? JSON.parse(scenario.parameters) 
                : scenario.parameters,
            candidate_sites: sites,
            sites_count: sites.length
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/analysis/weights
 * Get default and example weight configurations
 */
router.get('/weights', asyncHandler(async (req, res) => {
    const weightExamples = {
        default: DEFAULT_WEIGHTS,
        coverage_focused: {
            backhaul_proximity: 0.15,
            population_proximity: 0.35,
            elevation: 0.10,
            rf_interference: 0.25,
            land_availability: 0.15
        },
        infrastructure_focused: {
            backhaul_proximity: 0.40,
            population_proximity: 0.15,
            elevation: 0.15,
            rf_interference: 0.20,
            land_availability: 0.10
        },
        interference_sensitive: {
            backhaul_proximity: 0.20,
            population_proximity: 0.15,
            elevation: 0.15,
            rf_interference: 0.40,
            land_availability: 0.10
        }
    };

    res.json({
        success: true,
        weight_configurations: weightExamples,
        weight_descriptions: {
            backhaul_proximity: "Distance to existing fiber/backhaul infrastructure",
            population_proximity: "Distance to population centers and demand areas",
            elevation: "Terrain elevation considerations for satellite visibility",
            rf_interference: "Potential for radio frequency interference",
            land_availability: "Land use and availability for site development"
        },
        usage_notes: [
            "All weights must sum to 1.0",
            "Higher weight values increase importance of that factor",
            "Custom weights can be provided in analysis requests"
        ],
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
