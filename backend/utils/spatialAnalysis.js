/**
 * Spatial Analysis Utilities for Ground Station Site Selection
 * Contains algorithms for multi-factor scoring and optimization
 */

const { query } = require('./database');
const { getLocalElevation } = require('../services/elevationService');
const { getLocalPopulationDensity, calculateMarketDemand } = require('../services/populationService');
const { calculatePassOptimization, calculateLineOfSight } = require('../services/satelliteOptimization');
const { analyzeCrownLandAvailability } = require('../services/crownLandService');

/**
 * Default scoring weights for site analysis
 */
const DEFAULT_WEIGHTS = {
    backhaul_proximity: 0.20,      // Distance to existing infrastructure
    population_proximity: 0.15,    // Distance to population centers
    elevation: 0.15,               // Terrain elevation factors
    rf_interference: 0.15,         // RF interference potential
    land_availability: 0.15,       // Land use and availability
    satellite_optimization: 0.10,  // Satellite pass optimization
    market_demand: 0.10            // Market demand and business case
};

/**
 * Calculate distance-based score (closer = higher score)
 * @param {number} distance - Distance in meters
 * @param {number} maxDistance - Maximum useful distance
 * @returns {number} Score between 0 and 1
 */
function calculateDistanceScore(distance, maxDistance = 50000) {
    if (distance <= 0) return 1.0;
    if (distance >= maxDistance) return 0.0;
    return Math.max(0, 1 - (distance / maxDistance));
}

/**
 * Calculate elevation score (moderate elevation preferred)
 * @param {number} elevation - Elevation in meters
 * @returns {number} Score between 0 and 1
 */
function calculateElevationScore(elevation) {
    // Prefer elevations between 100-800m for satellite communication
    const optimalMin = 100;
    const optimalMax = 800;
    const penaltyFactor = 1000; // Meters beyond optimal range where score drops to 0
    
    if (elevation >= optimalMin && elevation <= optimalMax) {
        return 1.0;
    } else if (elevation < optimalMin) {
        const deficit = optimalMin - elevation;
        return Math.max(0, 1 - (deficit / penaltyFactor));
    } else {
        const excess = elevation - optimalMax;
        return Math.max(0, 1 - (excess / penaltyFactor));
    }
}

/**
 * Check if coordinates are likely to be on land (not in ocean)
 * Uses Australia's geographical boundaries and major inland water bodies
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {boolean} True if likely on land
 */
function isLikelyOnLand(longitude, latitude) {
    // First check: Must be within Australia's general bounds
    if (longitude < 112.9 || longitude > 153.7 || latitude < -43.7 || latitude > -9.2) {
        return false;
    }
    
    // Major ocean areas to exclude (simplified coastal filtering)
    // These are approximate ocean/major water body exclusions
    
    // Great Australian Bight (Southern Ocean)
    if (longitude >= 129.0 && longitude <= 140.0 && latitude <= -35.0) {
        return false;
    }
    
    // Tasman Sea (far eastern coast)
    if (longitude >= 152.0 && longitude <= 153.7) {
        // Check if too far from coast
        if ((latitude >= -37.0 && latitude <= -28.0) && longitude >= 152.5) {
            return false;
        }
    }
    
    // Bass Strait (between Victoria and Tasmania)
    if (longitude >= 144.0 && longitude <= 148.5 && latitude >= -40.5 && latitude <= -38.5) {
        return false;
    }
    
    // Spencer Gulf and Gulf St Vincent (SA)
    if (longitude >= 136.0 && longitude <= 138.5 && latitude >= -35.5 && latitude <= -32.5) {
        // These are complex coastal areas, be conservative
        if (longitude <= 137.0 && latitude >= -34.5) {
            return false; // Spencer Gulf
        }
        if (longitude >= 138.0 && latitude >= -34.0) {
            return false; // Gulf St Vincent
        }
    }
    
    // Coral Sea (far north Queensland)
    if (longitude >= 150.0 && latitude >= -16.0 && latitude <= -9.2) {
        return false;
    }
    
    // Timor Sea (far north)
    if (longitude >= 129.0 && longitude <= 135.0 && latitude >= -12.0) {
        return false;
    }
    
    // Indian Ocean (far west)
    if (longitude <= 115.0 && latitude <= -30.0) {
        return false;
    }
    
    // Additional validation: exclude obvious water bodies
    // Lake Eyre and other major inland lakes (simplified)
    if (longitude >= 136.0 && longitude <= 138.0 && latitude >= -30.0 && latitude <= -28.0) {
        // This is the Lake Eyre region - allow most of it as it's mostly dry land
        // Only exclude the actual lake center
        if (longitude >= 137.2 && longitude <= 137.6 && latitude >= -28.8 && latitude <= -28.4) {
            return false;
        }
    }
    
    // If none of the exclusions match, consider it land
    return true;
}

/**
 * Calculate RF interference score based on nearby transmitters
 * @param {Array} nearbyTowers - Array of nearby mobile towers
 * @returns {number} Score between 0 and 1
 */
function calculateRFInterferenceScore(nearbyTowers) {
    if (!nearbyTowers || nearbyTowers.length === 0) {
        return 1.0; // No interference
    }
    
    let interferenceScore = 0;
    
    nearbyTowers.forEach(tower => {
        const distance = tower.distance || 1000; // Default 1km if not provided
        const power = tower.power_dbm || 40; // Default power in dBm
        
        // Calculate interference based on power and distance
        // Higher power and closer distance = more interference
        const interferenceContribution = (power / 60) * (5000 / Math.max(distance, 100));
        interferenceScore += Math.min(interferenceContribution, 1.0);
    });
    
    // Invert score (less interference = higher score)
    return Math.max(0, 1 - Math.min(interferenceScore, 1.0));
}

/**
 * Analyze potential ground station sites within a bounding box
 * @param {Object} params - Analysis parameters
 * @returns {Promise<Array>} Array of candidate sites with scores
 */
async function analyzeSites(params = {}) {
    const {
        bbox, // [minLng, minLat, maxLng, maxLat]
        weights = DEFAULT_WEIGHTS,
        gridResolution = 0.01, // Grid resolution in degrees (~1km)
        maxSites = 50,
        minScore = 0.3
    } = params;
    
    if (!bbox || bbox.length !== 4) {
        throw new Error('Bounding box required: [minLng, minLat, maxLng, maxLat]');
    }
    
    const [minLng, minLat, maxLng, maxLat] = bbox;
    
    // Calculate area and adjust grid resolution to prevent excessive candidate sites
    const areaWidthDeg = Math.abs(maxLng - minLng);
    const areaHeightDeg = Math.abs(maxLat - minLat);
    const totalAreaDeg2 = areaWidthDeg * areaHeightDeg;
    
    // Adaptive grid resolution: larger areas get coarser resolution
    let adaptiveResolution = gridResolution;
    if (totalAreaDeg2 > 100) { // Very large area (> ~1000km x 1000km)
        adaptiveResolution = Math.max(0.5, gridResolution * 10); // 50km resolution
    } else if (totalAreaDeg2 > 25) { // Large area (> ~500km x 500km)
        adaptiveResolution = Math.max(0.2, gridResolution * 4); // 20km resolution
    } else if (totalAreaDeg2 > 4) { // Medium area (> ~200km x 200km)
        adaptiveResolution = Math.max(0.1, gridResolution * 2); // 10km resolution
    }
    
    // Calculate expected number of sites and limit if too many
    const expectedSites = Math.ceil(areaWidthDeg / adaptiveResolution) * Math.ceil(areaHeightDeg / adaptiveResolution);
    const maxGridSites = 1000; // Hard limit to prevent timeouts
    
    if (expectedSites > maxGridSites) {
        // Further increase resolution to stay under limit
        const reductionFactor = Math.sqrt(expectedSites / maxGridSites);
        adaptiveResolution = adaptiveResolution * reductionFactor;
    }
    
    console.log(`Area: ${areaWidthDeg.toFixed(2)}° x ${areaHeightDeg.toFixed(2)}°, Resolution: ${adaptiveResolution.toFixed(3)}°`);
    
    // Generate candidate sites on a grid, filtering out ocean locations
    const candidateSites = [];
    for (let lng = minLng; lng <= maxLng; lng += adaptiveResolution) {
        for (let lat = minLat; lat <= maxLat; lat += adaptiveResolution) {
            // Only add sites that are likely to be on land
            if (isLikelyOnLand(lng, lat)) {
                candidateSites.push({
                    longitude: lng,
                    latitude: lat,
                    id: `site_${lng.toFixed(4)}_${lat.toFixed(4)}`
                });
            }
        }
    }
    
    console.log(`Analyzing ${candidateSites.length} candidate sites with ${adaptiveResolution.toFixed(3)}° resolution...`);
    
    // Limit analysis for very large areas to avoid timeouts
    const maxAnalysisPoints = 100; // Limit for detailed analysis
    let sitesToAnalyze = candidateSites;
    
    if (candidateSites.length > maxAnalysisPoints) {
        // Sample sites more intelligently for large areas
        console.log(`Large area detected. Sampling ${maxAnalysisPoints} sites from ${candidateSites.length} candidates.`);
        const step = Math.floor(candidateSites.length / maxAnalysisPoints);
        sitesToAnalyze = candidateSites.filter((_, index) => index % step === 0).slice(0, maxAnalysisPoints);
    }
    
    console.log(`Running detailed analysis on ${sitesToAnalyze.length} sites...`);
    
    // Analyze each candidate site with error handling and batching
    const analyzedSites = [];
    const batchSize = 10; // Process sites in smaller batches to prevent overwhelming the system
    
    for (let i = 0; i < sitesToAnalyze.length; i += batchSize) {
        const batch = sitesToAnalyze.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sitesToAnalyze.length/batchSize)}`);
        
        const batchResults = await Promise.all(
            batch.map(async (site) => {
                try {
                    const score = await calculateSiteScore(site, weights);
                    return {
                        ...site,
                        ...score
                    };
                } catch (error) {
                    console.warn(`Error analyzing site ${site.id}:`, error.message);
                    return {
                        ...site,
                        total_score: 0,
                        error: error.message
                    };
                }
            })
        );
        
        analyzedSites.push(...batchResults);
        
        // Small delay between batches to prevent overwhelming the database
        if (i + batchSize < sitesToAnalyze.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Filter and sort by score
    const filteredSites = analyzedSites
        .filter(site => site.total_score >= minScore)
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, maxSites);
    
    console.log(`Found ${filteredSites.length} suitable sites out of ${candidateSites.length} analyzed`);
    
    return filteredSites;
}

/**
 * Calculate comprehensive score for a single site
 * @param {Object} site - Site coordinates
 * @param {Object} weights - Scoring weights
 * @returns {Promise<Object>} Site score breakdown
 */
async function calculateSiteScore(site, weights = DEFAULT_WEIGHTS) {
    const { longitude, latitude } = site;
    
    try {
        // Use basic scoring for performance - advanced features are too slow for large area analysis
        const basicScoring = await calculateBasicSiteScore(site, weights);
        return {
            ...basicScoring,
            analysis_type: 'optimized_basic'
        };
    } catch (error) {
        console.warn(`Error in site analysis for ${latitude}, ${longitude}:`, error.message);
        
        // Fallback with default values
        return {
            total_score: 0.5,
            score_breakdown: {
                backhaul_proximity: 0.5,
                population_proximity: 0.5,
                elevation: 0.5,
                rf_interference: 0.7,
                land_availability: 0.8
            },
            weights_used: weights,
            reasoning: "Fallback scoring due to analysis error",
            error: error.message,
            analysis_type: 'fallback_default'
        };
    }
}

/**
 * Calculate backhaul proximity score
 * @param {number} longitude - Site longitude
 * @param {number} latitude - Site latitude
 * @returns {Promise<number>} Backhaul proximity score
 */
async function calculateBackhaulScore(longitude, latitude) {
    try {
        // Find nearest fiber/backhaul infrastructure
        const backhaulQuery = `
            SELECT 
                MIN(ST_Distance(
                    ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)::geography,
                    ST_Point(longitude, latitude)::geography
                )) as min_distance
            FROM mobile_sites 
            WHERE technology LIKE '%5G%' OR technology LIKE '%Fiber%' OR backhaul_type LIKE '%Fiber%'
            LIMIT 1000;
        `;
        
        const result = await query(backhaulQuery);
        const distance = result.rows[0]?.min_distance || 50000; // Default 50km if no data
        
        return calculateDistanceScore(distance, 20000); // 20km max useful distance
    } catch (error) {
        console.warn('Error calculating backhaul score:', error.message);
        return 0.5; // Default moderate score
    }
}

/**
 * Calculate population proximity score
 * @param {number} longitude - Site longitude
 * @param {number} latitude - Site latitude
 * @returns {Promise<number>} Population proximity score
 */
async function calculatePopulationScore(longitude, latitude) {
    try {
        // Get actual population density using the enhanced population service
        const populationDensity = await getLocalPopulationDensity(longitude, latitude);
        
        // Convert population density to proximity score
        // Higher density = higher score, but with diminishing returns
        if (populationDensity > 1000) return 0.95;
        if (populationDensity > 500) return 0.85;
        if (populationDensity > 100) return 0.75;
        if (populationDensity > 50) return 0.65;
        if (populationDensity > 10) return 0.55;
        if (populationDensity > 1) return 0.45;
        return 0.3;
        
    } catch (error) {
        console.warn('Error calculating population score:', error.message);
        return 0.5; // Default moderate score
    }
}

/**
 * Calculate RF interference score for a location
 * @param {number} longitude - Site longitude
 * @param {number} latitude - Site latitude
 * @returns {Promise<number>} RF interference score
 */
async function calculateRFInterferenceScore(longitude, latitude) {
    try {
        // Find nearby transmitters within 10km
        const interferenceQuery = `
            SELECT 
                site_id,
                carrier,
                technology,
                height_agl,
                ST_Distance(
                    ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)::geography,
                    ST_Point(longitude, latitude)::geography
                ) as distance
            FROM mobile_sites
            WHERE ST_DWithin(
                ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)::geography,
                ST_Point(longitude, latitude)::geography,
                10000
            )
            ORDER BY distance
            LIMIT 20;
        `;
        
        const result = await query(interferenceQuery);
        return calculateRFInterferenceScore(result.rows);
    } catch (error) {
        console.warn('Error calculating RF interference score:', error.message);
        return 0.7; // Default good score
    }
}

/**
 * Generate human-readable reasoning for site score
 * @param {Object} scores - Individual score components
 * @returns {string} Reasoning text
 */
function generateReasoningText(scores) {
    const {
        backhaulScore,
        populationScore,
        elevationScore,
        rfScore,
        landScore,
        totalScore
    } = scores;
    
    let reasoning = [];
    
    if (totalScore >= 0.8) {
        reasoning.push("Excellent overall suitability for ground station deployment.");
    } else if (totalScore >= 0.6) {
        reasoning.push("Good suitability with some minor limitations.");
    } else if (totalScore >= 0.4) {
        reasoning.push("Moderate suitability, may require additional considerations.");
    } else {
        reasoning.push("Limited suitability, significant challenges present.");
    }
    
    // Backhaul analysis
    if (backhaulScore >= 0.8) {
        reasoning.push("Excellent backhaul connectivity available nearby.");
    } else if (backhaulScore >= 0.6) {
        reasoning.push("Good backhaul options within reasonable distance.");
    } else {
        reasoning.push("Limited backhaul infrastructure, may require dedicated connection.");
    }
    
    // RF interference analysis
    if (rfScore >= 0.8) {
        reasoning.push("Minimal RF interference expected from nearby transmitters.");
    } else if (rfScore >= 0.6) {
        reasoning.push("Moderate RF environment, manageable interference levels.");
    } else {
        reasoning.push("High RF interference area, frequency coordination required.");
    }
    
    // Population proximity
    if (populationScore >= 0.7) {
        reasoning.push("Well-positioned to serve population centers.");
    } else if (populationScore >= 0.4) {
        reasoning.push("Moderate population coverage potential.");
    } else {
        reasoning.push("Remote location with limited direct population service.");
    }
    
    return reasoning.join(" ");
}

/**
 * Fallback basic site scoring when advanced analysis fails
 */
async function calculateBasicSiteScore(site, weights) {
    const { longitude, latitude } = site;
    
    try {
        // Use fast calculations with timeouts
        const [backhaulScore, populationScore, rfScore] = await Promise.all([
            Promise.race([
                calculateBackhaulScore(longitude, latitude),
                new Promise(resolve => setTimeout(() => resolve(0.5), 2000)) // 2s timeout
            ]),
            Promise.race([
                calculatePopulationScore(longitude, latitude),
                new Promise(resolve => setTimeout(() => resolve(0.5), 2000)) // 2s timeout
            ]),
            Promise.race([
                calculateRFInterferenceScore(longitude, latitude),
                new Promise(resolve => setTimeout(() => resolve(0.7), 2000)) // 2s timeout
            ])
        ]);
        
        const elevationScore = calculateElevationScore(200); // Default elevation
        const landScore = 0.8; // Default good land availability
        
        const totalScore = 
            (backhaulScore * weights.backhaul_proximity) +
            (populationScore * weights.population_proximity) +
            (elevationScore * weights.elevation) +
            (rfScore * weights.rf_interference) +
            (landScore * weights.land_availability);
        
        return {
            total_score: Math.round(totalScore * 1000) / 1000,
            score_breakdown: {
                backhaul_proximity: backhaulScore,
                population_proximity: populationScore,
                elevation: elevationScore,
                rf_interference: rfScore,
                land_availability: landScore
            },
            weights_used: weights,
            reasoning: generateReasoningText({
                backhaulScore,
                populationScore,
                elevationScore,
                rfScore,
                landScore,
                totalScore: totalScore
            })
        };
    } catch (error) {
        console.warn(`Error in basic scoring for ${latitude}, ${longitude}:`, error.message);
        
        // Final fallback with reasonable defaults
        const defaultScore = 0.6;
        return {
            total_score: defaultScore,
            score_breakdown: {
                backhaul_proximity: 0.5,
                population_proximity: 0.5,
                elevation: 0.6,
                rf_interference: 0.7,
                land_availability: 0.8
            },
            weights_used: weights,
            reasoning: "Default scoring applied due to calculation errors"
        };
    }
}

/**
 * Generate advanced reasoning text with satellite and market analysis
 */
function generateAdvancedReasoningText(scores) {
    const {
        backhaulScore, populationScore, elevationScore, rfScore, landScore,
        satelliteScore, marketScore, totalScore, terrainElevation,
        satelliteOptimization, marketDemandAnalysis
    } = scores;
    
    const reasoning = [];
    
    // Overall assessment
    if (totalScore >= 0.8) {
        reasoning.push("Outstanding location for satellite ground station with excellent multi-factor optimization.");
    } else if (totalScore >= 0.6) {
        reasoning.push("Very good location with strong performance across multiple criteria.");
    } else if (totalScore >= 0.4) {
        reasoning.push("Moderate location with some advantages and limitations to consider.");
    } else {
        reasoning.push("Challenging location with significant limitations for ground station deployment.");
    }
    
    // Satellite-specific analysis
    if (satelliteOptimization?.pass_metrics) {
        const passMetrics = satelliteOptimization.pass_metrics;
        reasoning.push(`Satellite coverage: ${passMetrics.total_daily_passes} daily passes with ${passMetrics.avg_pass_duration_minutes}min average duration.`);
        
        if (passMetrics.max_elevation_angle > 60) {
            reasoning.push("Excellent satellite elevation angles achievable.");
        } else if (passMetrics.max_elevation_angle > 40) {
            reasoning.push("Good satellite elevation angles available.");
        } else {
            reasoning.push("Limited satellite elevation angles due to location constraints.");
        }
    }
    
    // Market demand analysis
    if (marketDemandAnalysis?.market_characteristics) {
        const market = marketDemandAnalysis.market_characteristics;
        if (market.is_metropolitan) {
            reasoning.push("Metropolitan area with high service demand potential.");
        } else if (market.is_urban) {
            reasoning.push("Urban area with good market opportunity.");
        } else if (market.is_remote) {
            reasoning.push("Remote area with underserved market opportunity.");
        }
        
        if (marketDemandAnalysis.estimated_population > 10000) {
            reasoning.push(`Serves approximately ${marketDemandAnalysis.estimated_population.toLocaleString()} people within service area.`);
        }
    }
    
    // Terrain analysis
    if (terrainElevation > 500) {
        reasoning.push(`Elevated terrain (${Math.round(terrainElevation)}m) provides good RF propagation advantages.`);
    } else if (terrainElevation < 50) {
        reasoning.push(`Low elevation (${Math.round(terrainElevation)}m) may have some propagation limitations.`);
    }
    
    // Infrastructure assessment
    if (backhaulScore > 0.7) {
        reasoning.push("Excellent backhaul infrastructure connectivity.");
    } else if (backhaulScore < 0.4) {
        reasoning.push("Limited backhaul infrastructure - dedicated connections may be required.");
    }
    
    return reasoning.join(" ");
}

module.exports = {
    analyzeSites,
    calculateSiteScore,
    calculateDistanceScore,
    calculateElevationScore,
    calculateRFInterferenceScore,
    calculateBasicSiteScore,
    DEFAULT_WEIGHTS
};
