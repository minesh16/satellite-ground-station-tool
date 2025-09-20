/**
 * Satellite Pass Optimization Service
 * Provides algorithms for optimizing satellite ground station placements
 * based on orbital mechanics and pass characteristics
 */

const { getLocalElevation, calculateSlope } = require('./elevationService');

// Kuiper constellation parameters (approximate)
const KUIPER_CONSTELLATION = {
    shells: [
        { altitude: 590, inclination: 51.9, num_sats: 784 },  // Shell 1
        { altitude: 610, inclination: 51.9, num_sats: 1296 }, // Shell 2  
        { altitude: 630, inclination: 51.9, num_sats: 1152 }  // Shell 3
    ],
    total_satellites: 3232,
    min_elevation_angle: 25, // Minimum elevation for useful communication
    operational_frequency_ghz: [17.8, 18.6, 19.7, 20.2] // Ka-band uplink
};

// Earth parameters
const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Calculate satellite pass optimization score for a ground station location
 * @param {number} longitude - Ground station longitude
 * @param {number} latitude - Ground station latitude
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} Pass optimization analysis
 */
async function calculatePassOptimization(longitude, latitude, options = {}) {
    try {
        const {
            target_elevation_angle = 35,  // Preferred minimum elevation
            analysis_period_hours = 24,
            weather_factor = 0.85        // Australian weather impact
        } = options;

        // Get terrain elevation for this location
        const terrainElevation = await getLocalElevation(longitude, latitude);
        
        // Calculate visibility metrics for each Kuiper shell
        const shellAnalysis = await Promise.all(
            KUIPER_CONSTELLATION.shells.map(shell => 
                analyzeShellVisibility(longitude, latitude, shell, target_elevation_angle, terrainElevation)
            )
        );

        // Calculate aggregate metrics
        const totalPasses = shellAnalysis.reduce((sum, shell) => sum + shell.daily_passes, 0);
        const avgPassDuration = shellAnalysis.reduce((sum, shell) => sum + shell.avg_pass_duration, 0) / shellAnalysis.length;
        const maxElevationAngle = Math.max(...shellAnalysis.map(shell => shell.max_elevation_angle));
        
        // Calculate coverage efficiency
        const coverageEfficiency = calculateCoverageEfficiency(shellAnalysis, analysis_period_hours);
        
        // Calculate link budget factors
        const linkBudget = calculateLinkBudgetFactors(maxElevationAngle, terrainElevation, weather_factor);
        
        // Calculate terrain obstruction impact
        const terrainImpact = await calculateTerrainObstruction(longitude, latitude, terrainElevation);
        
        // Overall optimization score (0-1)
        const optimizationScore = (
            (coverageEfficiency * 0.3) +
            (linkBudget.score * 0.25) +
            ((1 - terrainImpact.obstruction_factor) * 0.2) +
            (Math.min(maxElevationAngle / 90, 1) * 0.15) +
            (Math.min(totalPasses / 100, 1) * 0.1)
        );

        return {
            optimization_score: Math.round(optimizationScore * 1000) / 1000,
            pass_metrics: {
                total_daily_passes: totalPasses,
                avg_pass_duration_minutes: Math.round(avgPassDuration),
                max_elevation_angle: Math.round(maxElevationAngle * 10) / 10,
                coverage_efficiency: Math.round(coverageEfficiency * 1000) / 1000
            },
            shell_analysis: shellAnalysis,
            link_budget: linkBudget,
            terrain_analysis: {
                elevation_meters: terrainElevation,
                obstruction_impact: terrainImpact,
                terrain_advantage_score: calculateTerrainAdvantage(terrainElevation)
            },
            recommendations: generatePassRecommendations(optimizationScore, terrainImpact, linkBudget)
        };

    } catch (error) {
        console.warn('Error in satellite pass optimization:', error.message);
        return {
            optimization_score: 0.5,
            error: error.message,
            pass_metrics: {
                total_daily_passes: 50,
                avg_pass_duration_minutes: 8,
                max_elevation_angle: 60,
                coverage_efficiency: 0.6
            }
        };
    }
}

/**
 * Analyze satellite visibility for a specific Kuiper shell
 */
async function analyzeShellVisibility(longitude, latitude, shell, minElevation, terrainElevation) {
    // Calculate orbital period
    const orbitalRadius = EARTH_RADIUS_KM + shell.altitude;
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(orbitalRadius, 3) / 398600.4418); // seconds
    
    // Calculate coverage cone radius at minimum elevation
    const horizonAngle = Math.acos(EARTH_RADIUS_KM / orbitalRadius);
    const minElevationRadians = minElevation * DEGREES_TO_RADIANS;
    
    // Approximate number of visible satellites at any time
    const visibleSatellites = estimateVisibleSatellites(shell, latitude, minElevation);
    
    // Estimate daily passes based on orbital mechanics
    const dailyPasses = Math.round((86400 / orbitalPeriod) * visibleSatellites * 0.3); // 30% useful passes
    
    // Average pass duration (simplified calculation)
    const avgPassDuration = calculateAveragePassDuration(shell.altitude, minElevation);
    
    // Maximum elevation angle achievable
    const maxElevationAngle = calculateMaxElevationAngle(latitude, shell.inclination);

    return {
        shell_id: `shell_${shell.altitude}km`,
        altitude_km: shell.altitude,
        inclination_deg: shell.inclination,
        daily_passes: dailyPasses,
        avg_pass_duration: avgPassDuration,
        max_elevation_angle: maxElevationAngle,
        visible_satellites: visibleSatellites
    };
}

/**
 * Estimate number of visible satellites for a shell
 */
function estimateVisibleSatellites(shell, latitude, minElevation) {
    // Account for latitude effect on visibility
    const latitudeFactor = Math.cos(latitude * DEGREES_TO_RADIANS);
    
    // Account for inclination - higher inclination = more passes at higher latitudes
    const inclinationFactor = Math.min(1, shell.inclination / Math.abs(latitude));
    
    // Visibility cone calculation
    const elevationFactor = Math.sin((90 - minElevation) * DEGREES_TO_RADIANS);
    
    // Estimate based on shell density and coverage
    const baseCoverage = shell.num_sats / 500; // Normalized coverage factor
    
    return Math.round(baseCoverage * latitudeFactor * inclinationFactor * elevationFactor * 5);
}

/**
 * Calculate average pass duration
 */
function calculateAveragePassDuration(altitudeKm, minElevation) {
    // Simplified calculation based on altitude and elevation constraints
    const basePassDuration = 600; // 10 minutes base
    const altitudeFactor = Math.sqrt(altitudeKm / 600); // Higher = longer passes
    const elevationFactor = 1 - (minElevation / 90) * 0.5; // Higher min elevation = shorter passes
    
    return basePassDuration * altitudeFactor * elevationFactor / 60; // Convert to minutes
}

/**
 * Calculate maximum elevation angle achievable
 */
function calculateMaxElevationAngle(latitude, inclination) {
    // For inclined orbits, max elevation depends on latitude and inclination
    const latRad = Math.abs(latitude) * DEGREES_TO_RADIANS;
    const incRad = inclination * DEGREES_TO_RADIANS;
    
    if (Math.abs(latitude) <= inclination) {
        return 90; // Can achieve overhead passes
    } else {
        // Maximum elevation limited by inclination
        const maxElev = 90 - (Math.abs(latitude) - inclination);
        return Math.max(maxElev, 25); // Minimum useful elevation
    }
}

/**
 * Calculate coverage efficiency across all shells
 */
function calculateCoverageEfficiency(shellAnalysis, periodHours) {
    const totalMinutes = periodHours * 60;
    const totalCoverageMinutes = shellAnalysis.reduce((sum, shell) => 
        sum + (shell.daily_passes * shell.avg_pass_duration), 0
    );
    
    return Math.min(totalCoverageMinutes / totalMinutes, 1.0);
}

/**
 * Calculate link budget factors
 */
function calculateLinkBudgetFactors(maxElevationAngle, terrainElevation, weatherFactor) {
    // Free space path loss improvement with elevation
    const elevationGain = Math.sin(maxElevationAngle * DEGREES_TO_RADIANS);
    
    // Terrain gain (higher = better for satellite communication)
    const terrainGain = Math.min(terrainElevation / 1000, 1); // Normalize to 1km
    
    // Atmospheric losses (less at higher elevations)
    const atmosphericLoss = 1 - (terrainElevation / 10000) * 0.1; // 10% improvement per 10km
    
    // Rain fade and weather impact (Australia specific)
    const weatherImpact = weatherFactor;
    
    const overallScore = (elevationGain * 0.4) + (terrainGain * 0.3) + (atmosphericLoss * 0.2) + (weatherImpact * 0.1);
    
    return {
        score: Math.round(overallScore * 1000) / 1000,
        elevation_gain_db: Math.round(20 * Math.log10(elevationGain) * 10) / 10,
        terrain_gain_db: Math.round(10 * Math.log10(1 + terrainGain) * 10) / 10,
        weather_margin_db: Math.round(-10 * Math.log10(weatherImpact) * 10) / 10
    };
}

/**
 * Calculate terrain obstruction impact
 */
async function calculateTerrainObstruction(longitude, latitude, elevation) {
    try {
        // Sample terrain in 8 directions around the site
        const sampleDirections = [0, 45, 90, 135, 180, 225, 270, 315]; // degrees
        const sampleDistance = 0.01; // ~1km in degrees
        
        const terrainSamples = await Promise.all(
            sampleDirections.map(async (bearing) => {
                const bearingRad = bearing * DEGREES_TO_RADIANS;
                const sampleLat = latitude + sampleDistance * Math.cos(bearingRad);
                const sampleLon = longitude + sampleDistance * Math.sin(bearingRad);
                
                const sampleElevation = await getLocalElevation(sampleLon, sampleLat);
                const slope = Math.atan((sampleElevation - elevation) / 1000) * RADIANS_TO_DEGREES;
                
                return {
                    bearing,
                    elevation: sampleElevation,
                    slope: slope,
                    obstruction: slope > 15 // 15 degree obstruction threshold
                };
            })
        );
        
        const obstructedDirections = terrainSamples.filter(sample => sample.obstruction).length;
        const obstructionFactor = obstructedDirections / 8;
        
        return {
            obstruction_factor: obstructionFactor,
            obstructed_directions: obstructedDirections,
            terrain_samples: terrainSamples,
            horizon_clearance: obstructionFactor < 0.25 ? 'excellent' : 
                              obstructionFactor < 0.5 ? 'good' : 
                              obstructionFactor < 0.75 ? 'fair' : 'poor'
        };
        
    } catch (error) {
        console.warn('Error calculating terrain obstruction:', error.message);
        return {
            obstruction_factor: 0.3,
            horizon_clearance: 'unknown',
            error: error.message
        };
    }
}

/**
 * Calculate terrain advantage score
 */
function calculateTerrainAdvantage(elevation) {
    // Optimal elevation range for satellite communication (200-800m)
    if (elevation >= 200 && elevation <= 800) {
        return 1.0;
    } else if (elevation < 200) {
        return 0.6 + (elevation / 200) * 0.4; // Linear increase from sea level
    } else {
        return Math.max(0.3, 1.0 - ((elevation - 800) / 2000) * 0.7); // Decrease for very high elevations
    }
}

/**
 * Generate recommendations based on optimization analysis
 */
function generatePassRecommendations(optimizationScore, terrainImpact, linkBudget) {
    const recommendations = [];
    
    if (optimizationScore > 0.8) {
        recommendations.push("Excellent location for satellite ground station with optimal pass characteristics");
    } else if (optimizationScore > 0.6) {
        recommendations.push("Good location with satisfactory satellite coverage");
    } else if (optimizationScore > 0.4) {
        recommendations.push("Marginal location - consider terrain improvements or alternative sites");
    } else {
        recommendations.push("Poor location for satellite operations - significant limitations identified");
    }
    
    if (terrainImpact.obstruction_factor > 0.5) {
        recommendations.push("High terrain obstruction detected - consider site clearing or elevation");
    }
    
    if (linkBudget.score < 0.6) {
        recommendations.push("Challenging RF environment - additional link margin may be required");
    }
    
    return recommendations;
}

/**
 * Calculate line-of-sight analysis between two points
 * @param {number} lon1 - Start longitude
 * @param {number} lat1 - Start latitude 
 * @param {number} lon2 - End longitude
 * @param {number} lat2 - End latitude
 * @param {number} height1 - Start height above ground (meters)
 * @param {number} height2 - End height above ground (meters)
 * @returns {Promise<Object>} Line-of-sight analysis
 */
async function calculateLineOfSight(lon1, lat1, lon2, lat2, height1 = 10, height2 = 0) {
    try {
        // Get elevations for start and end points
        const [elev1, elev2] = await Promise.all([
            getLocalElevation(lon1, lat1),
            getLocalElevation(lon2, lat2)
        ]);
        
        // Calculate total heights above sea level
        const totalHeight1 = elev1 + height1;
        const totalHeight2 = elev2 + height2;
        
        // Calculate horizontal distance
        const distance = calculateHorizontalDistance(lat1, lon1, lat2, lon2);
        
        // Sample terrain along the path
        const numSamples = Math.min(Math.max(Math.floor(distance / 1000), 5), 20); // 1 sample per km, 5-20 samples
        const pathSamples = [];
        
        for (let i = 1; i < numSamples - 1; i++) {
            const fraction = i / (numSamples - 1);
            const sampleLat = lat1 + (lat2 - lat1) * fraction;
            const sampleLon = lon1 + (lon2 - lon1) * fraction;
            const sampleElev = await getLocalElevation(sampleLon, sampleLat);
            
            pathSamples.push({
                latitude: sampleLat,
                longitude: sampleLon,
                elevation: sampleElev,
                distance_from_start: distance * fraction
            });
        }
        
        // Check for obstructions
        const obstructions = [];
        const lineSlope = (totalHeight2 - totalHeight1) / distance;
        
        for (const sample of pathSamples) {
            const expectedHeight = totalHeight1 + lineSlope * sample.distance_from_start;
            const clearance = expectedHeight - sample.elevation;
            
            if (clearance < 0) {
                obstructions.push({
                    ...sample,
                    obstruction_height: Math.abs(clearance),
                    clearance: clearance
                });
            }
        }
        
        const isLineClear = obstructions.length === 0;
        const minClearance = pathSamples.length > 0 ? 
            Math.min(...pathSamples.map(s => {
                const expectedHeight = totalHeight1 + lineSlope * s.distance_from_start;
                return expectedHeight - s.elevation;
            })) : 100;
        
        return {
            line_of_sight_clear: isLineClear,
            distance_km: Math.round(distance / 1000 * 100) / 100,
            elevation_difference: totalHeight2 - totalHeight1,
            min_clearance_meters: Math.round(minClearance),
            obstructions: obstructions,
            path_samples: pathSamples.length,
            fresnel_zone_clearance: calculateFresnelZone(distance, minClearance)
        };
        
    } catch (error) {
        console.warn('Error calculating line of sight:', error.message);
        return {
            line_of_sight_clear: false,
            error: error.message
        };
    }
}

/**
 * Calculate horizontal distance between two points
 */
function calculateHorizontalDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * DEGREES_TO_RADIANS;
    const φ2 = lat2 * DEGREES_TO_RADIANS;
    const Δφ = (lat2 - lat1) * DEGREES_TO_RADIANS;
    const Δλ = (lon2 - lon1) * DEGREES_TO_RADIANS;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

/**
 * Calculate Fresnel zone clearance
 */
function calculateFresnelZone(distance, clearance) {
    // First Fresnel zone radius calculation for satellite frequencies
    const frequency = 20e9; // 20 GHz (Ka-band)
    const c = 3e8; // Speed of light
    const wavelength = c / frequency;
    
    // Maximum Fresnel zone radius (at midpoint)
    const maxRadius = Math.sqrt(wavelength * distance / 4);
    
    const clearanceRatio = clearance / maxRadius;
    
    if (clearanceRatio >= 0.6) return 'excellent';
    if (clearanceRatio >= 0.3) return 'good';
    if (clearanceRatio >= 0.0) return 'marginal';
    return 'blocked';
}

module.exports = {
    calculatePassOptimization,
    calculateLineOfSight,
    analyzeShellVisibility,
    KUIPER_CONSTELLATION
};
