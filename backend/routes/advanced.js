/**
 * Advanced analysis routes for Phase 4 features
 * Handles elevation data, population analysis, satellite optimization, and crown land analysis
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { 
    getPointElevation, 
    calculateSlope, 
    createElevationGrid,
    storeElevationData 
} = require('../services/elevationService');
const { 
    calculateMarketDemand, 
    getPopulationDensity,
    storePopulationData 
} = require('../services/populationService');
const { 
    calculatePassOptimization, 
    calculateLineOfSight 
} = require('../services/satelliteOptimization');
const { 
    analyzeCrownLandAvailability 
} = require('../services/crownLandService');

const router = express.Router();

/**
 * GET /api/advanced/elevation
 * Get elevation data for a specific point or area
 */
router.get('/elevation', asyncHandler(async (req, res) => {
    const { longitude, latitude, area_analysis } = req.query;
    
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }
    
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);
    
    if (area_analysis === 'true') {
        // Area analysis - create elevation grid around point
        const buffer = 0.05; // ~5km buffer
        const bbox = [lon - buffer, lat - buffer, lon + buffer, lat + buffer];
        const elevationGrid = await createElevationGrid(bbox, 0.01);
        
        res.json({
            success: true,
            analysis_type: 'elevation_grid',
            center_point: { longitude: lon, latitude: lat },
            bbox: bbox,
            grid_points: elevationGrid.length,
            elevation_data: elevationGrid
        });
    } else {
        // Single point elevation
        const elevation = await getPointElevation(lon, lat);
        
        res.json({
            success: true,
            analysis_type: 'point_elevation',
            location: { longitude: lon, latitude: lat },
            elevation_meters: elevation,
            data_source: 'ELVIS_API'
        });
    }
}));

/**
 * POST /api/advanced/elevation/slope
 * Calculate slope between two points
 */
router.post('/elevation/slope', asyncHandler(async (req, res) => {
    const { start_point, end_point } = req.body;
    
    if (!start_point?.longitude || !start_point?.latitude || 
        !end_point?.longitude || !end_point?.latitude) {
        throw createError('Start and end points with longitude/latitude required', 400);
    }
    
    const slope = await calculateSlope(
        start_point.longitude, start_point.latitude,
        end_point.longitude, end_point.latitude
    );
    
    res.json({
        success: true,
        start_point: start_point,
        end_point: end_point,
        slope_degrees: slope,
        slope_percentage: Math.tan(slope * Math.PI / 180) * 100,
        analysis_timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/advanced/population
 * Get population density and market demand analysis
 */
router.get('/population', asyncHandler(async (req, res) => {
    const { longitude, latitude, radius = 25000 } = req.query;
    
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }
    
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const analysisRadius = parseInt(radius);
    
    const [populationDensity, marketDemand] = await Promise.all([
        getPopulationDensity(lon, lat),
        calculateMarketDemand(lon, lat, analysisRadius)
    ]);
    
    res.json({
        success: true,
        location: { longitude: lon, latitude: lat },
        analysis_radius_meters: analysisRadius,
        population_density_per_km2: populationDensity,
        market_analysis: marketDemand,
        data_source: 'ABS_ESTIMATED',
        analysis_timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/advanced/satellite-optimization
 * Get satellite pass optimization analysis
 */
router.get('/satellite-optimization', asyncHandler(async (req, res) => {
    const { 
        longitude, 
        latitude, 
        target_elevation_angle = 35,
        analysis_period_hours = 24,
        weather_factor = 0.85 
    } = req.query;
    
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }
    
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);
    
    const optimization = await calculatePassOptimization(lon, lat, {
        target_elevation_angle: parseFloat(target_elevation_angle),
        analysis_period_hours: parseFloat(analysis_period_hours),
        weather_factor: parseFloat(weather_factor)
    });
    
    res.json({
        success: true,
        location: { longitude: lon, latitude: lat },
        analysis_parameters: {
            target_elevation_angle: parseFloat(target_elevation_angle),
            analysis_period_hours: parseFloat(analysis_period_hours),
            weather_factor: parseFloat(weather_factor)
        },
        satellite_optimization: optimization,
        analysis_timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/advanced/line-of-sight
 * Calculate line-of-sight analysis between two points
 */
router.post('/line-of-sight', asyncHandler(async (req, res) => {
    const { 
        start_point, 
        end_point, 
        start_height = 10, 
        end_height = 0 
    } = req.body;
    
    if (!start_point?.longitude || !start_point?.latitude || 
        !end_point?.longitude || !end_point?.latitude) {
        throw createError('Start and end points with longitude/latitude required', 400);
    }
    
    const losAnalysis = await calculateLineOfSight(
        start_point.longitude, start_point.latitude,
        end_point.longitude, end_point.latitude,
        parseFloat(start_height), parseFloat(end_height)
    );
    
    res.json({
        success: true,
        start_point: { ...start_point, height_above_ground: parseFloat(start_height) },
        end_point: { ...end_point, height_above_ground: parseFloat(end_height) },
        line_of_sight_analysis: losAnalysis,
        analysis_timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/advanced/crown-land
 * Get Crown land availability analysis
 */
router.get('/crown-land', asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.query;
    
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }
    
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);
    
    const crownLandAnalysis = await analyzeCrownLandAvailability(lon, lat);
    
    res.json({
        success: true,
        location: { longitude: lon, latitude: lat },
        crown_land_analysis: crownLandAnalysis,
        analysis_timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/advanced/comprehensive-analysis
 * Run comprehensive advanced analysis for a location
 */
router.post('/comprehensive-analysis', asyncHandler(async (req, res) => {
    const { 
        longitude, 
        latitude, 
        analysis_options = {} 
    } = req.body;
    
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }
    
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);
    
    console.log(`Running comprehensive analysis for ${lat}, ${lon}`);
    
    // Run all advanced analyses in parallel
    const [
        elevation,
        marketDemand,
        satelliteOptimization,
        crownLandAnalysis
    ] = await Promise.all([
        getPointElevation(lon, lat).catch(err => ({ error: err.message })),
        calculateMarketDemand(lon, lat).catch(err => ({ error: err.message })),
        calculatePassOptimization(lon, lat).catch(err => ({ error: err.message })),
        analyzeCrownLandAvailability(lon, lat).catch(err => ({ error: err.message }))
    ]);
    
    // Calculate overall advanced score
    const advancedScore = calculateAdvancedScore({
        elevation,
        marketDemand,
        satelliteOptimization,
        crownLandAnalysis
    });
    
    res.json({
        success: true,
        location: { longitude: lon, latitude: lat },
        advanced_analysis: {
            elevation_analysis: {
                elevation_meters: elevation,
                data_source: 'ELVIS_API'
            },
            market_analysis: marketDemand,
            satellite_optimization: satelliteOptimization,
            crown_land_analysis: crownLandAnalysis,
            overall_advanced_score: advancedScore,
            analysis_timestamp: new Date().toISOString()
        }
    });
}));

/**
 * Calculate overall advanced analysis score
 */
function calculateAdvancedScore(analyses) {
    const scores = [];
    
    // Elevation score (optimal range 200-800m)
    if (typeof analyses.elevation === 'number') {
        const elevation = analyses.elevation;
        if (elevation >= 200 && elevation <= 800) {
            scores.push(1.0);
        } else if (elevation < 200) {
            scores.push(0.6 + (elevation / 200) * 0.4);
        } else {
            scores.push(Math.max(0.3, 1.0 - ((elevation - 800) / 2000) * 0.7));
        }
    }
    
    // Market demand score
    if (analyses.marketDemand?.overall_demand_score) {
        scores.push(analyses.marketDemand.overall_demand_score);
    }
    
    // Satellite optimization score
    if (analyses.satelliteOptimization?.optimization_score) {
        scores.push(analyses.satelliteOptimization.optimization_score);
    }
    
    // Crown land availability score
    if (analyses.crownLandAnalysis?.land_availability_score) {
        scores.push(analyses.crownLandAnalysis.land_availability_score);
    }
    
    // Calculate weighted average
    const averageScore = scores.length > 0 ? 
        scores.reduce((sum, score) => sum + score, 0) / scores.length : 
        0.5;
    
    return Math.round(averageScore * 1000) / 1000;
}

/**
 * GET /api/advanced/capabilities
 * Get information about available advanced analysis capabilities
 */
router.get('/capabilities', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        advanced_capabilities: {
            elevation_services: {
                point_elevation: 'Get elevation for specific coordinates using ELVIS API',
                elevation_grid: 'Generate elevation grid for area analysis',
                slope_calculation: 'Calculate terrain slope between two points',
                data_sources: ['ELVIS', 'Estimated terrain models']
            },
            population_services: {
                population_density: 'Get population density estimates',
                market_demand: 'Comprehensive market demand analysis',
                service_area_analysis: 'Population within service radius',
                data_sources: ['ABS estimates', 'Infrastructure-based modeling']
            },
            satellite_optimization: {
                pass_optimization: 'Kuiper constellation pass analysis',
                coverage_efficiency: 'Daily coverage and pass duration metrics',
                elevation_angles: 'Maximum achievable satellite elevation',
                line_of_sight: 'Terrain obstruction analysis',
                constellation_data: 'Kuiper orbital parameters and shell analysis'
            },
            crown_land_analysis: {
                land_availability: 'Crown land availability assessment',
                regulatory_zones: 'Exclusion zone analysis',
                land_use_classification: 'Automated land use estimation',
                state_specific_info: 'State-by-state crown land policies',
                approval_guidance: 'Next steps for land acquisition'
            },
            export_capabilities: {
                comprehensive_reports: 'PDF reports with all analysis factors',
                spatial_data: 'GeoJSON export for GIS applications',
                tabular_data: 'CSV export for spreadsheet analysis'
            }
        },
        integration_notes: {
            apis_used: ['ELVIS elevation', 'ABS population (estimated)', 'Orbital mechanics calculations'],
            data_quality: 'Mix of real-time API data and estimated models',
            update_frequency: 'Elevation and population data updated on-demand',
            limitations: 'Some analyses use simplified models pending full API integration'
        }
    });
}));

module.exports = router;
