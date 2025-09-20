/**
 * Sites routes for detailed site information and reasoning
 * Handles individual site analysis and detailed reporting
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { query } = require('../utils/database');
const { calculateSiteScore, DEFAULT_WEIGHTS } = require('../utils/spatialAnalysis');

const router = express.Router();

/**
 * GET /api/sites/:siteId/reasoning
 * Get detailed reasoning for a specific candidate site
 */
router.get('/:siteId/reasoning', asyncHandler(async (req, res) => {
    const { siteId } = req.params;

    // Get site details from database
    const siteQuery = `
        SELECT 
            cs.site_id,
            cs.scenario_id,
            ST_X(cs.geom) as longitude,
            ST_Y(cs.geom) as latitude,
            cs.total_score,
            cs.score_breakdown,
            cs.reasoning,
            cs.rank_order,
            ST_AsGeoJSON(cs.geom) as geometry,
            s.scenario_name,
            s.parameters
        FROM candidate_sites cs
        JOIN analysis_scenarios s ON cs.scenario_id = s.scenario_id
        WHERE cs.site_id = $1;
    `;

    const result = await query(siteQuery, [siteId]);

    if (result.rows.length === 0) {
        throw createError('Site not found', 404);
    }

    const site = result.rows[0];
    
    // Parse JSON fields
    const scoreBreakdown = typeof site.score_breakdown === 'string' 
        ? JSON.parse(site.score_breakdown) 
        : site.score_breakdown;
    
    const parameters = typeof site.parameters === 'string'
        ? JSON.parse(site.parameters)
        : site.parameters;

    // Get nearby infrastructure for context
    const nearbyInfraQuery = `
        SELECT 
            'mobile_site' as infrastructure_type,
            site_id as infrastructure_id,
            carrier,
            technology,
            ST_Distance(
                ST_Point(longitude, latitude)::geography,
                ST_GeomFromText('POINT(${site.longitude} ${site.latitude})', 4326)::geography
            ) as distance_meters,
            longitude,
            latitude
        FROM mobile_sites
        WHERE ST_DWithin(
            ST_Point(longitude, latitude)::geography,
            ST_GeomFromText('POINT(${site.longitude} ${site.latitude})', 4326)::geography,
            20000
        )
        ORDER BY distance_meters
        LIMIT 10;
    `;

    const nearbyResult = await query(nearbyInfraQuery);

    // Generate detailed reasoning report
    const detailedReasoning = generateDetailedReasoning(
        site,
        scoreBreakdown,
        nearbyResult.rows,
        parameters.weights || DEFAULT_WEIGHTS
    );

    res.json({
        success: true,
        site: {
            site_id: site.site_id,
            scenario_id: site.scenario_id,
            scenario_name: site.scenario_name,
            coordinates: {
                longitude: site.longitude,
                latitude: site.latitude
            },
            geometry: JSON.parse(site.geometry),
            total_score: site.total_score,
            rank_order: site.rank_order,
            score_breakdown: scoreBreakdown,
            weights_used: parameters.weights || DEFAULT_WEIGHTS,
            reasoning: {
                summary: site.reasoning,
                detailed: detailedReasoning
            },
            nearby_infrastructure: nearbyResult.rows,
            analysis_context: {
                scenario_parameters: parameters,
                grid_resolution_km: (parameters.gridResolution || 0.01) * 111,
                analysis_date: site.created_at
            }
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/sites/analyze
 * Analyze a specific location provided by coordinates
 */
router.post('/analyze', asyncHandler(async (req, res) => {
    const {
        longitude,
        latitude,
        weights = DEFAULT_WEIGHTS,
        site_name = 'Custom Location Analysis'
    } = req.body;

    // Validate coordinates
    if (!longitude || !latitude) {
        throw createError('Longitude and latitude required', 400);
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw createError('Invalid coordinates', 400);
    }

    // Validate weights
    const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 0.1) {
        throw createError('Weights must sum to approximately 1.0', 400);
    }

    console.log(`Analyzing specific location: ${latitude}, ${longitude}`);

    // Perform site analysis
    const site = { longitude, latitude, id: `custom_${Date.now()}` };
    const analysisResult = await calculateSiteScore(site, weights);

    // Get nearby infrastructure for context
    const nearbyInfraQuery = `
        SELECT 
            'mobile_site' as infrastructure_type,
            site_id as infrastructure_id,
            carrier,
            technology,
            height_agl,
            ST_Distance(
                ST_Point(longitude, latitude)::geography,
                ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)::geography
            ) as distance_meters,
            longitude,
            latitude
        FROM mobile_sites
        WHERE ST_DWithin(
            ST_Point(longitude, latitude)::geography,
            ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)::geography,
            25000
        )
        ORDER BY distance_meters
        LIMIT 15;
    `;

    const nearbyResult = await query(nearbyInfraQuery);

    // Generate comprehensive analysis report
    const detailedAnalysis = generateDetailedReasoning(
        { longitude, latitude, ...analysisResult },
        analysisResult.score_breakdown,
        nearbyResult.rows,
        weights
    );

    res.json({
        success: true,
        site_analysis: {
            site_name,
            coordinates: { longitude, latitude },
            total_score: analysisResult.total_score,
            score_breakdown: analysisResult.score_breakdown,
            weights_used: weights,
            reasoning: {
                summary: analysisResult.reasoning,
                detailed: detailedAnalysis
            },
            nearby_infrastructure: nearbyResult.rows,
            recommendations: generateRecommendations(analysisResult, nearbyResult.rows),
            analysis_metadata: {
                analysis_type: 'point_analysis',
                analysis_time: new Date().toISOString(),
                coordinate_system: 'WGS84',
                search_radius_km: 25
            }
        }
    });
}));

/**
 * GET /api/sites/compare
 * Compare multiple site locations
 */
router.get('/compare', asyncHandler(async (req, res) => {
    const { site_ids, coordinates } = req.query;

    let sitesToCompare = [];

    // Handle comparison by site IDs
    if (site_ids) {
        const ids = site_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        
        if (ids.length === 0) {
            throw createError('Valid site IDs required', 400);
        }

        const sitesQuery = `
            SELECT 
                cs.site_id,
                ST_X(cs.geom) as longitude,
                ST_Y(cs.geom) as latitude,
                cs.total_score,
                cs.score_breakdown,
                cs.reasoning,
                cs.rank_order,
                s.scenario_name
            FROM candidate_sites cs
            JOIN analysis_scenarios s ON cs.scenario_id = s.scenario_id
            WHERE cs.site_id = ANY($1)
            ORDER BY cs.total_score DESC;
        `;

        const result = await query(sitesQuery, [ids]);
        sitesToCompare = result.rows.map(site => ({
            ...site,
            score_breakdown: typeof site.score_breakdown === 'string' 
                ? JSON.parse(site.score_breakdown) 
                : site.score_breakdown,
            source: 'database'
        }));
    }

    // Handle comparison by coordinates
    if (coordinates) {
        const coordPairs = coordinates.split(';');
        
        for (let i = 0; i < coordPairs.length && i < 5; i++) { // Limit to 5 sites
            const [lng, lat] = coordPairs[i].split(',').map(Number);
            
            if (!isNaN(lng) && !isNaN(lat)) {
                const site = { longitude: lng, latitude: lat, id: `compare_${i}` };
                const analysis = await calculateSiteScore(site, DEFAULT_WEIGHTS);
                
                sitesToCompare.push({
                    site_id: `compare_${i}`,
                    longitude: lng,
                    latitude: lat,
                    total_score: analysis.total_score,
                    score_breakdown: analysis.score_breakdown,
                    reasoning: analysis.reasoning,
                    source: 'coordinates'
                });
            }
        }
    }

    if (sitesToCompare.length === 0) {
        throw createError('No valid sites provided for comparison', 400);
    }

    // Generate comparison analysis
    const comparison = generateComparisonAnalysis(sitesToCompare);

    res.json({
        success: true,
        comparison: {
            sites: sitesToCompare,
            comparison_analysis: comparison,
            site_count: sitesToCompare.length,
            best_site: sitesToCompare.reduce((best, site) => 
                site.total_score > best.total_score ? site : best
            ),
            analysis_timestamp: new Date().toISOString()
        }
    });
}));

/**
 * Generate detailed reasoning for a site
 */
function generateDetailedReasoning(site, scoreBreakdown, nearbyInfra, weights) {
    const reasoning = {
        overall_assessment: generateOverallAssessment(site.total_score),
        factor_analysis: {},
        infrastructure_context: generateInfrastructureContext(nearbyInfra),
        recommendations: []
    };

    // Analyze each scoring factor
    Object.entries(scoreBreakdown).forEach(([factor, score]) => {
        reasoning.factor_analysis[factor] = {
            score: score,
            weight: weights[factor] || 0,
            weighted_contribution: score * (weights[factor] || 0),
            assessment: generateFactorAssessment(factor, score),
            improvement_suggestions: generateImprovementSuggestions(factor, score)
        };
    });

    // Generate recommendations based on analysis
    reasoning.recommendations = generateSiteRecommendations(scoreBreakdown, nearbyInfra);

    return reasoning;
}

function generateOverallAssessment(totalScore) {
    if (totalScore >= 0.8) {
        return {
            rating: "Excellent",
            description: "This location demonstrates exceptional suitability for ground station deployment with strong performance across multiple criteria.",
            confidence: "High"
        };
    } else if (totalScore >= 0.6) {
        return {
            rating: "Good",
            description: "This location shows good potential for ground station deployment with manageable limitations.",
            confidence: "Medium-High"
        };
    } else if (totalScore >= 0.4) {
        return {
            rating: "Moderate",
            description: "This location has moderate suitability but may require additional mitigation measures.",
            confidence: "Medium"
        };
    } else {
        return {
            rating: "Limited",
            description: "This location presents significant challenges for ground station deployment.",
            confidence: "Low"
        };
    }
}

function generateFactorAssessment(factor, score) {
    const assessments = {
        backhaul_proximity: score >= 0.7 ? "Excellent backhaul access" : score >= 0.5 ? "Good connectivity options" : "Limited backhaul infrastructure",
        population_proximity: score >= 0.7 ? "Optimal population coverage" : score >= 0.5 ? "Reasonable market access" : "Remote location",
        elevation: score >= 0.7 ? "Ideal elevation profile" : score >= 0.5 ? "Acceptable terrain" : "Challenging topography",
        rf_interference: score >= 0.7 ? "Clean RF environment" : score >= 0.5 ? "Manageable interference" : "High interference area",
        land_availability: score >= 0.7 ? "Favorable land conditions" : score >= 0.5 ? "Standard development requirements" : "Complex land use issues"
    };
    
    return assessments[factor] || "Assessment not available";
}

function generateImprovementSuggestions(factor, score) {
    if (score >= 0.7) return ["No significant improvements needed"];
    
    const suggestions = {
        backhaul_proximity: [
            "Consider dedicated fiber installation",
            "Evaluate microwave backhaul options",
            "Investigate satellite backhaul as alternative"
        ],
        population_proximity: [
            "Assess mobile service coverage extension",
            "Consider deployment timing with urban expansion",
            "Evaluate specialized service markets"
        ],
        elevation: [
            "Conduct detailed terrain analysis",
            "Consider antenna tower height adjustments",
            "Evaluate alternative nearby locations"
        ],
        rf_interference: [
            "Perform detailed RF survey",
            "Coordinate with existing operators",
            "Consider frequency planning and filtering"
        ],
        land_availability: [
            "Conduct detailed land use assessment",
            "Investigate zoning requirements",
            "Consider alternative site configurations"
        ]
    };
    
    return suggestions[factor] || ["Conduct specialized assessment"];
}

function generateInfrastructureContext(nearbyInfra) {
    const context = {
        summary: `${nearbyInfra.length} infrastructure elements within 25km`,
        carrier_presence: {},
        technology_mix: {},
        closest_infrastructure: null
    };

    if (nearbyInfra.length > 0) {
        // Analyze carrier presence
        nearbyInfra.forEach(infra => {
            if (infra.carrier) {
                context.carrier_presence[infra.carrier] = 
                    (context.carrier_presence[infra.carrier] || 0) + 1;
            }
            if (infra.technology) {
                context.technology_mix[infra.technology] = 
                    (context.technology_mix[infra.technology] || 0) + 1;
            }
        });

        context.closest_infrastructure = {
            type: nearbyInfra[0].infrastructure_type,
            distance_km: Math.round(nearbyInfra[0].distance_meters / 1000 * 10) / 10,
            carrier: nearbyInfra[0].carrier,
            technology: nearbyInfra[0].technology
        };
    }

    return context;
}

function generateSiteRecommendations(scoreBreakdown, nearbyInfra) {
    const recommendations = [];

    // Score-based recommendations
    if (scoreBreakdown.backhaul_proximity < 0.5) {
        recommendations.push({
            category: "Infrastructure",
            priority: "High",
            recommendation: "Investigate dedicated backhaul solutions due to limited existing infrastructure"
        });
    }

    if (scoreBreakdown.rf_interference < 0.6) {
        recommendations.push({
            category: "RF Planning",
            priority: "Medium",
            recommendation: "Conduct detailed RF interference study and coordination with nearby operators"
        });
    }

    if (nearbyInfra.length > 10) {
        recommendations.push({
            category: "Coordination",
            priority: "Medium",
            recommendation: "High infrastructure density area - coordinate with multiple existing operators"
        });
    }

    return recommendations;
}

function generateRecommendations(analysisResult, nearbyInfra) {
    const recommendations = [];
    const { score_breakdown } = analysisResult;

    // Generate specific recommendations based on scores
    if (score_breakdown.backhaul_proximity >= 0.8) {
        recommendations.push("Excellent backhaul connectivity - proceed with infrastructure planning");
    } else if (score_breakdown.backhaul_proximity < 0.5) {
        recommendations.push("Consider alternative backhaul solutions or site relocation");
    }

    if (score_breakdown.rf_interference < 0.6) {
        recommendations.push("Recommend detailed RF survey before deployment");
    }

    if (nearbyInfra.length === 0) {
        recommendations.push("Remote location - consider logistics and maintenance access");
    }

    return recommendations;
}

function generateComparisonAnalysis(sites) {
    const analysis = {
        score_range: {
            highest: Math.max(...sites.map(s => s.total_score)),
            lowest: Math.min(...sites.map(s => s.total_score)),
            average: sites.reduce((sum, s) => sum + s.total_score, 0) / sites.length
        },
        factor_leaders: {},
        recommendations: []
    };

    // Find leader in each factor
    const factors = Object.keys(sites[0].score_breakdown);
    factors.forEach(factor => {
        const leader = sites.reduce((best, site) => 
            site.score_breakdown[factor] > best.score_breakdown[factor] ? site : best
        );
        analysis.factor_leaders[factor] = {
            site_id: leader.site_id,
            score: leader.score_breakdown[factor]
        };
    });

    // Generate comparison recommendations
    if (analysis.score_range.highest - analysis.score_range.lowest > 0.3) {
        analysis.recommendations.push("Significant score variation - focus on highest scoring sites");
    }

    return analysis;
}

module.exports = router;
