/**
 * ABS Population Data Service
 * Provides population density and demographic data integration
 * Uses Australian Bureau of Statistics APIs and data
 */

const axios = require('axios');
const { query } = require('../utils/database');

// ABS API Configuration
const ABS_API_BASE = 'https://api.data.abs.gov.au';
const ABS_STAT_API = 'https://stat.data.abs.gov.au/sdmx-json/data';

/**
 * Population density estimates for major Australian cities and regions
 * Source: ABS Regional Population data approximations
 */
const POPULATION_REGIONS = {
    // Major capital cities
    sydney: { center: [151.2093, -33.8688], radius: 50000, density: 2037 },
    melbourne: { center: [144.9631, -37.8136], radius: 45000, density: 1566 },
    brisbane: { center: [153.0251, -27.4698], radius: 35000, density: 1031 },
    perth: { center: [115.8605, -31.9505], radius: 30000, density: 1618 },
    adelaide: { center: [138.6007, -34.9285], radius: 25000, density: 1295 },
    canberra: { center: [149.1300, -35.2809], radius: 20000, density: 1680 },
    hobart: { center: [147.3272, -42.8821], radius: 15000, density: 1357 },
    darwin: { center: [130.8456, -12.4634], radius: 15000, density: 703 },
    
    // Regional centers
    goldCoast: { center: [153.4000, -28.0167], radius: 25000, density: 1300 },
    newcastle: { center: [151.7817, -32.9283], radius: 20000, density: 1100 },
    wollongong: { center: [150.8931, -34.4278], radius: 15000, density: 1200 },
    sunshine_coast: { center: [153.0667, -26.6500], radius: 20000, density: 800 },
    geelong: { center: [144.3600, -38.1500], radius: 15000, density: 900 },
    townsville: { center: [146.8169, -19.2590], radius: 15000, density: 650 },
    cairns: { center: [145.7781, -16.9186], radius: 12000, density: 550 },
    toowoomba: { center: [151.9507, -27.5598], radius: 12000, density: 400 },
    ballarat: { center: [143.8503, -37.5622], radius: 10000, density: 350 },
    bendigo: { center: [144.2794, -36.7570], radius: 10000, density: 300 },
    
    // Mining/resource centers
    kalgoorlie: { center: [121.4733, -30.7489], radius: 8000, density: 150 },
    mount_isa: { center: [139.4927, -20.7256], radius: 8000, density: 120 },
    karratha: { center: [116.8446, -20.7364], radius: 5000, density: 100 },
    port_hedland: { center: [118.6060, -20.3110], radius: 5000, density: 80 },
    
    // Rural regions (lower density baseline)
    rural_nsw: { density: 5 },
    rural_vic: { density: 8 },
    rural_qld: { density: 3 },
    rural_sa: { density: 2 },
    rural_wa: { density: 1 },
    rural_tas: { density: 12 },
    rural_nt: { density: 0.5 },
    rural_act: { density: 50 }
};

/**
 * Get population density for a specific location
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {Promise<number>} Population density per km²
 */
async function getPopulationDensity(longitude, latitude) {
    try {
        // Check if point is within any major population center
        for (const [regionName, region] of Object.entries(POPULATION_REGIONS)) {
            if (region.center && region.radius) {
                const distance = calculateDistance(
                    latitude, longitude,
                    region.center[1], region.center[0]
                );
                
                if (distance <= region.radius) {
                    // Apply distance decay function
                    const decayFactor = Math.exp(-distance / (region.radius * 0.3));
                    return region.density * decayFactor;
                }
            }
        }
        
        // Determine rural baseline based on state
        const state = determineState(longitude, latitude);
        const ruralKey = `rural_${state.toLowerCase()}`;
        return POPULATION_REGIONS[ruralKey]?.density || 2;
        
    } catch (error) {
        console.warn(`Error calculating population density for ${latitude}, ${longitude}:`, error.message);
        return 5; // Default rural density
    }
}

/**
 * Get batch population density for multiple points
 * @param {Array} points - Array of {longitude, latitude} objects
 * @returns {Promise<Array>} Array of population density values
 */
async function getBatchPopulationDensity(points) {
    return await Promise.all(
        points.map(point => getPopulationDensity(point.longitude, point.latitude))
    );
}

/**
 * Calculate market demand score based on population metrics
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @param {number} radius - Analysis radius in meters (default 25km)
 * @returns {Promise<Object>} Market demand analysis
 */
async function calculateMarketDemand(longitude, latitude, radius = 25000) {
    try {
        const populationDensity = await getPopulationDensity(longitude, latitude);
        
        // Calculate total population within radius
        const estimatedPopulation = populationDensity * Math.PI * Math.pow(radius / 1000, 2);
        
        // Determine market characteristics
        const isUrban = populationDensity > 100;
        const isMetropolitan = populationDensity > 500;
        const isRemote = populationDensity < 5;
        
        // Calculate demand factors
        const internetDemand = calculateInternetDemand(populationDensity, isUrban);
        const businessDemand = calculateBusinessDemand(populationDensity, isMetropolitan);
        const infrastructureGap = calculateInfrastructureGap(isRemote, populationDensity);
        
        // Overall market demand score (0-1)
        const demandScore = Math.min(1.0, 
            (internetDemand * 0.4) + 
            (businessDemand * 0.3) + 
            (infrastructureGap * 0.3)
        );
        
        return {
            population_density: populationDensity,
            estimated_population: Math.round(estimatedPopulation),
            market_characteristics: {
                is_urban: isUrban,
                is_metropolitan: isMetropolitan,
                is_remote: isRemote
            },
            demand_factors: {
                internet_demand: internetDemand,
                business_demand: businessDemand,
                infrastructure_gap: infrastructureGap
            },
            overall_demand_score: Math.round(demandScore * 1000) / 1000
        };
        
    } catch (error) {
        console.warn('Error calculating market demand:', error.message);
        return {
            population_density: 5,
            estimated_population: 400,
            overall_demand_score: 0.3,
            error: error.message
        };
    }
}

/**
 * Calculate internet service demand based on population characteristics
 */
function calculateInternetDemand(density, isUrban) {
    if (density > 1000) return 0.9; // High urban demand
    if (density > 500) return 0.8;  // Suburban demand
    if (density > 100) return 0.7;  // Regional town demand
    if (density > 10) return 0.6;   // Rural town demand
    return 0.5; // Remote area demand
}

/**
 * Calculate business/enterprise demand
 */
function calculateBusinessDemand(density, isMetropolitan) {
    if (isMetropolitan) return 0.8;
    if (density > 200) return 0.6;
    if (density > 50) return 0.4;
    return 0.2;
}

/**
 * Calculate infrastructure gap (higher gap = higher opportunity)
 */
function calculateInfrastructureGap(isRemote, density) {
    if (isRemote && density > 1) return 0.9; // Remote but populated
    if (isRemote) return 0.7; // Very remote
    if (density < 50) return 0.6; // Underserved regional
    return 0.3; // Well-served urban
}

/**
 * Determine Australian state/territory from coordinates
 */
function determineState(longitude, latitude) {
    // Simplified state boundaries
    if (longitude > 140.97 && longitude < 153.64 && latitude > -37.51 && latitude < -10.68) return 'QLD';
    if (longitude > 140.97 && longitude < 150.04 && latitude > -39.20 && latitude < -33.98) return 'NSW';
    if (longitude > 140.97 && longitude < 149.98 && latitude > -39.20 && latitude < -33.98) return 'ACT';
    if (longitude > 140.97 && longitude < 150.04 && latitude > -43.64 && latitude < -39.13) return 'TAS';
    if (longitude > 140.97 && longitude < 150.04 && latitude > -39.20 && latitude < -33.98) return 'VIC';
    if (longitude > 129.00 && longitude < 141.00 && latitude > -38.06 && latitude < -25.99) return 'SA';
    if (longitude > 112.92 && longitude < 129.00 && latitude > -35.13 && latitude < -13.69) return 'WA';
    if (longitude > 129.00 && longitude < 138.00 && latitude > -25.99 && latitude < -10.96) return 'NT';
    return 'NSW'; // Default
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

/**
 * Store population data in database
 * @param {Array} populationData - Array of population data points
 * @returns {Promise<void>}
 */
async function storePopulationData(populationData) {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS population_data (
                id SERIAL PRIMARY KEY,
                longitude DOUBLE PRECISION NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                population_density DOUBLE PRECISION NOT NULL,
                estimated_population INTEGER,
                market_demand_score DOUBLE PRECISION,
                data_source VARCHAR(50) DEFAULT 'ABS_ESTIMATED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                geometry GEOMETRY(POINT, 4326)
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_population_geometry 
            ON population_data USING GIST (geometry);
        `);

        // Insert data in batches
        const batchSize = 1000;
        for (let i = 0; i < populationData.length; i += batchSize) {
            const batch = populationData.slice(i, i + batchSize);
            
            const values = batch.map((point, index) => 
                `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, ST_SetSRID(ST_MakePoint($${index * 5 + 1}, $${index * 5 + 2}), 4326))`
            ).join(', ');

            const params = batch.flatMap(point => [
                point.longitude,
                point.latitude,
                point.population_density,
                point.estimated_population || null
            ]);

            await query(`
                INSERT INTO population_data (longitude, latitude, population_density, estimated_population, geometry)
                VALUES ${values}
                ON CONFLICT DO NOTHING;
            `, params);
        }

        console.log(`Stored ${populationData.length} population data points`);
    } catch (error) {
        console.error('Error storing population data:', error.message);
        throw error;
    }
}

/**
 * Get local population data from database with fallback
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {Promise<number>} Population density
 */
async function getLocalPopulationDensity(longitude, latitude) {
    try {
        // Check if population_data table exists
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'population_data'
            );
        `);

        if (tableCheck.rows[0].exists) {
            const result = await query(`
                SELECT population_density,
                       ST_Distance(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
                FROM population_data
                WHERE ST_DWithin(
                    geometry,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    5000
                )
                ORDER BY distance
                LIMIT 1;
            `, [longitude, latitude]);

            if (result.rows.length > 0) {
                return result.rows[0].population_density;
            }
        }

        // Fallback to estimated population density
        return await getPopulationDensity(longitude, latitude);
    } catch (error) {
        console.warn('Error getting local population density:', error.message);
        return await getPopulationDensity(longitude, latitude);
    }
}

module.exports = {
    getPopulationDensity,
    getBatchPopulationDensity,
    calculateMarketDemand,
    storePopulationData,
    getLocalPopulationDensity,
    POPULATION_REGIONS
};
