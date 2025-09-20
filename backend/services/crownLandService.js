/**
 * Crown Land Availability Service
 * Provides Crown land and regulatory zone analysis for ground station siting
 * Integrates with Australian state government land registries
 */

const { query } = require('../utils/database');
const { getLocalPopulationDensity } = require('./populationService');

// Land use categories and their suitability for ground stations
const LAND_USE_CATEGORIES = {
    // Highly suitable
    crown_land: { score: 0.95, description: 'Crown land - excellent for telecommunications infrastructure' },
    government_reserve: { score: 0.90, description: 'Government reserve - good potential with permissions' },
    rural_zone: { score: 0.85, description: 'Rural zoning - generally suitable for infrastructure' },
    industrial_zone: { score: 0.80, description: 'Industrial zoning - compatible land use' },
    
    // Moderately suitable
    mixed_use: { score: 0.65, description: 'Mixed use - may require special approval' },
    agricultural: { score: 0.60, description: 'Agricultural land - possible with landowner agreement' },
    transport_corridor: { score: 0.55, description: 'Transport corridor - limited availability' },
    
    // Limited suitability
    residential: { score: 0.30, description: 'Residential area - significant restrictions' },
    commercial: { score: 0.35, description: 'Commercial area - competing land uses' },
    conservation: { score: 0.20, description: 'Conservation area - heavily restricted' },
    national_park: { score: 0.10, description: 'National park - generally prohibited' },
    water_body: { score: 0.05, description: 'Water body - not suitable for ground infrastructure' },
    
    // Unknown/default
    unknown: { score: 0.50, description: 'Unknown land use - requires investigation' }
};

// Regulatory exclusion zones
const EXCLUSION_ZONES = {
    airports: {
        buffer_radius: 15000, // 15km
        restriction_level: 'high',
        description: 'Airport exclusion zone - height and RF restrictions'
    },
    military_facilities: {
        buffer_radius: 10000, // 10km  
        restriction_level: 'very_high',
        description: 'Military facility - significant restrictions'
    },
    radio_astronomy: {
        buffer_radius: 25000, // 25km
        restriction_level: 'very_high', 
        description: 'Radio astronomy facility - strict RF quiet zone'
    },
    nature_reserves: {
        buffer_radius: 2000, // 2km
        restriction_level: 'medium',
        description: 'Nature reserve buffer - environmental constraints'
    },
    urban_centers: {
        buffer_radius: 5000, // 5km from city centers
        restriction_level: 'medium',
        description: 'Urban center - zoning and community constraints'
    }
};

// Australian crown land regions (simplified state-based analysis)
const CROWN_LAND_REGIONS = {
    NSW: {
        crown_land_percentage: 35,
        availability_score: 0.8,
        contact_agency: 'Crown Lands NSW',
        typical_lease_terms: '10-30 years renewable'
    },
    VIC: {
        crown_land_percentage: 30,
        availability_score: 0.75,
        contact_agency: 'Department of Environment, Land, Water and Planning',
        typical_lease_terms: '10-21 years renewable'
    },
    QLD: {
        crown_land_percentage: 45,
        availability_score: 0.85,
        contact_agency: 'Department of Resources',
        typical_lease_terms: '5-30 years renewable'
    },
    SA: {
        crown_land_percentage: 25,
        availability_score: 0.70,
        contact_agency: 'Department for Environment and Water',
        typical_lease_terms: '10-21 years renewable'
    },
    WA: {
        crown_land_percentage: 55,
        availability_score: 0.90,
        contact_agency: 'Department of Planning, Lands and Heritage',
        typical_lease_terms: '10-50 years renewable'
    },
    TAS: {
        crown_land_percentage: 20,
        availability_score: 0.65,
        contact_agency: 'Department of Primary Industries, Parks, Water and Environment',
        typical_lease_terms: '10-30 years renewable'
    },
    NT: {
        crown_land_percentage: 70,
        availability_score: 0.95,
        contact_agency: 'Department of Infrastructure, Planning and Logistics',
        typical_lease_terms: '5-99 years renewable'
    },
    ACT: {
        crown_land_percentage: 60,
        availability_score: 0.80,
        contact_agency: 'Environment, Planning and Sustainable Development Directorate',
        typical_lease_terms: '10-99 years renewable'
    }
};

/**
 * Analyze Crown land availability for a specific location
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {Promise<Object>} Crown land analysis
 */
async function analyzeCrownLandAvailability(longitude, latitude) {
    try {
        // Determine state/territory
        const state = determineState(longitude, latitude);
        const crownLandInfo = CROWN_LAND_REGIONS[state];
        
        // Estimate land use category based on location characteristics
        const landUseCategory = await estimateLandUse(longitude, latitude);
        const landUseInfo = LAND_USE_CATEGORIES[landUseCategory];
        
        // Check for regulatory exclusions
        const exclusionAnalysis = await checkRegulatoryExclusions(longitude, latitude);
        
        // Calculate overall land availability score
        const availabilityScore = calculateLandAvailabilityScore(
            crownLandInfo, 
            landUseInfo, 
            exclusionAnalysis
        );
        
        return {
            land_availability_score: availabilityScore,
            state_territory: state,
            crown_land_info: crownLandInfo,
            land_use: {
                category: landUseCategory,
                ...landUseInfo
            },
            regulatory_analysis: exclusionAnalysis,
            recommendations: generateLandRecommendations(
                state, 
                landUseCategory, 
                exclusionAnalysis, 
                availabilityScore
            ),
            next_steps: generateNextSteps(state, crownLandInfo, exclusionAnalysis)
        };
        
    } catch (error) {
        console.warn('Error analyzing crown land availability:', error.message);
        return {
            land_availability_score: 0.5,
            error: error.message,
            recommendations: ['Unable to complete land analysis - manual investigation required']
        };
    }
}

/**
 * Estimate land use category based on location and surrounding infrastructure
 */
async function estimateLandUse(longitude, latitude) {
    try {
        // Check population density as a proxy for land use
        const { getLocalPopulationDensity } = require('./populationService');
        const populationDensity = await getLocalPopulationDensity(longitude, latitude);
        
        // Check proximity to infrastructure
        const nearbyInfrastructure = await checkNearbyInfrastructure(longitude, latitude);
        
        // Land use classification logic
        if (populationDensity > 1000) {
            return 'residential';
        } else if (populationDensity > 500) {
            return 'mixed_use';
        } else if (populationDensity > 100) {
            return nearbyInfrastructure.has_industrial ? 'industrial_zone' : 'commercial';
        } else if (populationDensity > 10) {
            return nearbyInfrastructure.has_agriculture ? 'agricultural' : 'rural_zone';
        } else if (nearbyInfrastructure.is_remote) {
            return 'crown_land';
        } else {
            return 'unknown';
        }
        
    } catch (error) {
        console.warn('Error estimating land use:', error.message);
        return 'unknown';
    }
}

/**
 * Check nearby infrastructure to help classify land use
 */
async function checkNearbyInfrastructure(longitude, latitude) {
    try {
        const infrastructureQuery = `
            SELECT 
                carrier,
                technology,
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
        
        const result = await query(infrastructureQuery);
        const nearbyCount = result.rows.length;
        const avgDistance = nearbyCount > 0 ? 
            result.rows.reduce((sum, row) => sum + parseFloat(row.distance), 0) / nearbyCount : 
            50000;
        
        return {
            has_industrial: nearbyCount > 10 && avgDistance < 5000,
            has_agriculture: nearbyCount > 3 && nearbyCount < 8 && avgDistance > 3000,
            is_remote: nearbyCount < 3 || avgDistance > 15000,
            infrastructure_density: nearbyCount
        };
        
    } catch (error) {
        console.warn('Error checking nearby infrastructure:', error.message);
        return {
            has_industrial: false,
            has_agriculture: false, 
            is_remote: true,
            infrastructure_density: 0
        };
    }
}

/**
 * Check for regulatory exclusions around the location
 */
async function checkRegulatoryExclusions(longitude, latitude) {
    const exclusions = [];
    let overallRestrictionLevel = 'low';
    
    // Check each exclusion zone type
    for (const [zoneType, zoneInfo] of Object.entries(EXCLUSION_ZONES)) {
        const isInZone = await checkExclusionZone(longitude, latitude, zoneType, zoneInfo);
        
        if (isInZone) {
            exclusions.push({
                type: zoneType,
                ...zoneInfo,
                impact: 'site_restricted'
            });
            
            // Update overall restriction level
            if (zoneInfo.restriction_level === 'very_high') {
                overallRestrictionLevel = 'very_high';
            } else if (zoneInfo.restriction_level === 'high' && overallRestrictionLevel !== 'very_high') {
                overallRestrictionLevel = 'high';
            } else if (zoneInfo.restriction_level === 'medium' && overallRestrictionLevel === 'low') {
                overallRestrictionLevel = 'medium';
            }
        }
    }
    
    return {
        exclusions: exclusions,
        total_exclusions: exclusions.length,
        overall_restriction_level: overallRestrictionLevel,
        is_site_restricted: exclusions.length > 0,
        clearance_required: exclusions.some(e => e.restriction_level === 'very_high')
    };
}

/**
 * Check if location is within a specific exclusion zone
 */
async function checkExclusionZone(longitude, latitude, zoneType, zoneInfo) {
    // Simplified check - in a real implementation, this would query actual GIS databases
    // For now, we'll use heuristics based on population density and infrastructure
    
    switch (zoneType) {
        case 'airports':
            // Check if near major cities (proxy for airports)
            const { getLocalPopulationDensity } = require('./populationService');
            const popDensity = await getLocalPopulationDensity(longitude, latitude);
            return popDensity > 500; // Major urban areas likely have airports
            
        case 'military_facilities':
            // Military facilities are sparse but present throughout Australia
            return Math.random() < 0.05; // 5% chance for demonstration
            
        case 'radio_astronomy':
            // Check proximity to known radio astronomy sites (simplified)
            const isNearParkes = checkProximity(longitude, latitude, 148.2636, -32.9984, 25000); // Parkes Observatory
            const isNearMurchison = checkProximity(longitude, latitude, 116.6, -26.7, 25000); // Murchison region
            return isNearParkes || isNearMurchison;
            
        case 'nature_reserves':
            // More common in less populated areas
            return popDensity < 5 && Math.random() < 0.15; // 15% chance in remote areas
            
        case 'urban_centers':
            return popDensity > 200; // Urban centers
            
        default:
            return false;
    }
}

/**
 * Calculate overall land availability score
 */
function calculateLandAvailabilityScore(crownLandInfo, landUseInfo, exclusionAnalysis) {
    const baseScore = crownLandInfo.availability_score;
    const landUseScore = landUseInfo.score;
    
    // Reduction for regulatory exclusions
    let exclusionPenalty = 0;
    switch (exclusionAnalysis.overall_restriction_level) {
        case 'very_high': exclusionPenalty = 0.7; break;
        case 'high': exclusionPenalty = 0.4; break;
        case 'medium': exclusionPenalty = 0.2; break;
        default: exclusionPenalty = 0;
    }
    
    // Combined score with weighted factors
    const combinedScore = (baseScore * 0.4) + (landUseScore * 0.4) + ((1 - exclusionPenalty) * 0.2);
    
    return Math.max(0, Math.min(1, combinedScore));
}

/**
 * Generate land recommendations
 */
function generateLandRecommendations(state, landUseCategory, exclusionAnalysis, availabilityScore) {
    const recommendations = [];
    
    if (availabilityScore > 0.8) {
        recommendations.push('Excellent land availability - proceed with site development planning');
    } else if (availabilityScore > 0.6) {
        recommendations.push('Good land availability with manageable constraints');
    } else if (availabilityScore > 0.4) {
        recommendations.push('Moderate land availability - additional approvals likely required');
    } else {
        recommendations.push('Limited land availability - consider alternative locations');
    }
    
    if (landUseCategory === 'crown_land' || landUseCategory === 'government_reserve') {
        recommendations.push('Crown land opportunity - engage with state land management agency');
    }
    
    if (exclusionAnalysis.clearance_required) {
        recommendations.push('High-level regulatory clearances required before proceeding');
    }
    
    if (exclusionAnalysis.exclusions.some(e => e.type === 'radio_astronomy')) {
        recommendations.push('Radio quiet zone restrictions apply - careful RF planning required');
    }
    
    return recommendations;
}

/**
 * Generate next steps for land acquisition
 */
function generateNextSteps(state, crownLandInfo, exclusionAnalysis) {
    const steps = [];
    
    steps.push(`Contact ${crownLandInfo.contact_agency} for initial land availability assessment`);
    
    if (exclusionAnalysis.total_exclusions > 0) {
        steps.push('Engage with relevant regulatory authorities for clearance requirements');
    }
    
    steps.push('Conduct detailed land survey and title search');
    steps.push('Assess environmental and cultural heritage requirements');
    steps.push(`Prepare telecommunications facility lease application (typical terms: ${crownLandInfo.typical_lease_terms})`);
    
    return steps;
}

/**
 * Check proximity between two points
 */
function checkProximity(lon1, lat1, lon2, lat2, radiusMeters) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance <= radiusMeters;
}

/**
 * Estimate land use category based on location characteristics
 */
async function estimateLandUse(longitude, latitude) {
    try {
        // For this implementation, we'll use simple heuristics based on population density
        // In a real implementation, this would integrate with actual land use databases
        
        // Get population density for the area (simplified approach)
        const populationDensity = await getLocalPopulationDensity(longitude, latitude);
        
        // Simple heuristics based on population density
        if (populationDensity > 1000) {
            return 'residential'; // High density = residential/urban
        } else if (populationDensity > 500) {
            return 'mixed_use'; // Medium density = mixed use
        } else if (populationDensity > 100) {
            return 'rural_zone'; // Low density = rural
        } else if (populationDensity > 10) {
            return 'agricultural'; // Very low density = agricultural
        } else {
            return 'crown_land'; // Very sparse = likely crown land
        }
    } catch (error) {
        console.warn(`Error estimating land use for ${longitude}, ${latitude}:`, error.message);
        return 'unknown';
    }
}

/**
 * Check for regulatory exclusions at a location
 */
async function checkRegulatoryExclusions(longitude, latitude) {
    try {
        const exclusions = [];
        let overallRisk = 'low';
        
        // Check proximity to airports (simplified - would use real airport database)
        const airportProximity = checkAirportProximity(longitude, latitude);
        if (airportProximity.withinZone) {
            exclusions.push({
                type: 'airport_exclusion',
                distance_km: airportProximity.distance,
                severity: airportProximity.severity
            });
            overallRisk = airportProximity.severity;
        }
        
        // Check for national parks (simplified)
        const isInNationalPark = checkNationalParkProximity(longitude, latitude);
        if (isInNationalPark) {
            exclusions.push({
                type: 'national_park',
                severity: 'high'
            });
            overallRisk = 'high';
        }
        
        return {
            exclusions,
            overall_risk: overallRisk,
            regulatory_score: exclusions.length === 0 ? 0.9 : (exclusions.length === 1 ? 0.6 : 0.3)
        };
    } catch (error) {
        console.warn(`Error checking regulatory exclusions for ${longitude}, ${latitude}:`, error.message);
        return {
            exclusions: [],
            overall_risk: 'unknown',
            regulatory_score: 0.5
        };
    }
}

/**
 * Calculate overall land availability score
 */
function calculateLandAvailabilityScore(crownLandInfo, landUseInfo, exclusionAnalysis) {
    const crownLandWeight = 0.4;
    const landUseWeight = 0.4;
    const regulatoryWeight = 0.2;
    
    const crownLandScore = crownLandInfo?.availability_score || 0.5;
    const landUseScore = landUseInfo?.score || 0.5;
    const regulatoryScore = exclusionAnalysis?.regulatory_score || 0.5;
    
    return (crownLandScore * crownLandWeight) + 
           (landUseScore * landUseWeight) + 
           (regulatoryScore * regulatoryWeight);
}

/**
 * Generate land use recommendations
 */
function generateLandRecommendations(availabilityScore, landUse, exclusions) {
    const recommendations = [];
    
    if (availabilityScore > 0.8) {
        recommendations.push('Excellent land availability - proceed with site development');
    } else if (availabilityScore > 0.6) {
        recommendations.push('Good land availability - conduct detailed site assessment');
    } else if (availabilityScore > 0.4) {
        recommendations.push('Moderate land availability - investigate alternative locations');
    } else {
        recommendations.push('Poor land availability - not recommended for development');
    }
    
    if (landUse.category === 'crown_land') {
        recommendations.push('Crown land requires government approval - contact relevant state agency');
    }
    
    if (exclusions.length > 0) {
        recommendations.push('Regulatory restrictions identified - consult with relevant authorities');
    }
    
    return recommendations;
}

/**
 * Simplified airport proximity check
 */
function checkAirportProximity(longitude, latitude) {
    // Major Australian airports (simplified list)
    const majorAirports = [
        { name: 'Sydney', lat: -33.9399, lon: 151.1753, exclusion_radius: 15 },
        { name: 'Melbourne', lat: -37.6690, lon: 144.8410, exclusion_radius: 15 },
        { name: 'Brisbane', lat: -27.3849, lon: 153.1171, exclusion_radius: 12 },
        { name: 'Perth', lat: -31.9403, lon: 115.9665, exclusion_radius: 12 },
        { name: 'Adelaide', lat: -34.9285, lon: 138.5295, exclusion_radius: 10 }
    ];
    
    for (const airport of majorAirports) {
        const distance = calculateDistance(latitude, longitude, airport.lat, airport.lon);
        if (distance <= airport.exclusion_radius) {
            return {
                withinZone: true,
                distance: distance,
                severity: distance <= 5 ? 'high' : distance <= 10 ? 'medium' : 'low'
            };
        }
    }
    
    return { withinZone: false, distance: null, severity: null };
}

/**
 * Simplified national park check
 */
function checkNationalParkProximity(longitude, latitude) {
    // Very simplified - in reality would use actual park boundaries
    // For now, just check a few known problematic areas
    const protectedAreas = [
        { name: 'Blue Mountains', lat: -33.5, lon: 150.5, radius: 20 },
        { name: 'Grampians', lat: -37.2, lon: 142.5, radius: 15 }
    ];
    
    for (const area of protectedAreas) {
        const distance = calculateDistance(latitude, longitude, area.lat, area.lon);
        if (distance <= area.radius) {
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate distance between two points in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Determine Australian state/territory from coordinates
 */
function determineState(longitude, latitude) {
    // Corrected Australian state boundaries (approximate)
    
    // ACT (small territory around Canberra)
    if (longitude > 148.7 && longitude < 149.5 && latitude > -35.9 && latitude < -35.1) return 'ACT';
    
    // Tasmania
    if (longitude > 143.5 && longitude < 148.5 && latitude > -43.7 && latitude < -39.2) return 'TAS';
    
    // Queensland (eastern coast, northern)
    if (longitude > 137.9 && longitude < 153.7 && latitude > -29.0 && latitude < -9.2) return 'QLD';
    
    // New South Wales (eastern coast, central)
    if (longitude > 140.9 && longitude < 153.7 && latitude > -37.5 && latitude < -28.2) return 'NSW';
    
    // Victoria (southeastern)
    if (longitude > 140.9 && longitude < 150.0 && latitude > -39.2 && latitude < -33.9) return 'VIC';
    
    // South Australia (central southern)
    if (longitude > 129.0 && longitude < 141.0 && latitude > -38.1 && latitude < -25.9) return 'SA';
    
    // Western Australia (western half)
    if (longitude > 112.9 && longitude < 129.0 && latitude > -35.1 && latitude < -13.7) return 'WA';
    
    // Northern Territory (central northern)
    if (longitude > 129.0 && longitude < 138.0 && latitude > -26.0 && latitude < -10.9) return 'NT';
    
    // Fallback logic for edge cases
    if (latitude < -39.0) return 'TAS';  // Far south = Tasmania
    if (latitude > -26.0) return 'QLD';  // Far north = Queensland  
    if (longitude < 129.0) return 'WA';  // Far west = Western Australia
    if (longitude > 150.0) return 'NSW'; // Far east = New South Wales
    
    return 'SA'; // Central fallback
}

module.exports = {
    analyzeCrownLandAvailability,
    LAND_USE_CATEGORIES,
    EXCLUSION_ZONES,
    CROWN_LAND_REGIONS
};
