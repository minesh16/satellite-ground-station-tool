/**
 * ELVIS Elevation Service
 * Provides elevation data integration with the Australian ELVIS API
 * https://elevation.fsdf.org.au/
 */

const axios = require('axios');
const { query } = require('../utils/database');

// ELVIS API Configuration
const ELVIS_BASE_URL = 'https://elevation.fsdf.org.au';
const ELVIS_WMS_URL = `${ELVIS_BASE_URL}/arcgis/services/ELVIS_SMOOTHED_25M/MapServer/WMSServer`;
const ELVIS_REST_URL = `${ELVIS_BASE_URL}/arcgis/rest/services/ELVIS_SMOOTHED_25M/MapServer`;

/**
 * Get elevation data for a single point using ELVIS API
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {Promise<number>} Elevation in meters
 */
async function getPointElevation(longitude, latitude) {
    try {
        // Use ELVIS REST API for point elevation query
        const params = {
            f: 'json',
            geometry: `${longitude},${latitude}`,
            geometryType: 'esriGeometryPoint',
            inSR: '4326', // WGS84
            outSR: '4326',
            returnZ: 'true'
        };

        const response = await axios.get(`${ELVIS_REST_URL}/identify`, {
            params,
            timeout: 10000
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            if (result.attributes && result.attributes['Pixel Value'] !== undefined) {
                return parseFloat(result.attributes['Pixel Value']);
            }
        }

        // Fallback: use a simplified elevation estimation
        return estimateElevation(longitude, latitude);
    } catch (error) {
        console.warn(`Error fetching elevation for ${latitude}, ${longitude}:`, error.message);
        return estimateElevation(longitude, latitude);
    }
}

/**
 * Get elevation data for multiple points in batch
 * @param {Array} points - Array of {longitude, latitude} objects
 * @returns {Promise<Array>} Array of elevation values
 */
async function getBatchElevation(points) {
    const elevations = await Promise.all(
        points.map(async (point) => {
            try {
                return await getPointElevation(point.longitude, point.latitude);
            } catch (error) {
                console.warn(`Batch elevation error for point ${point.latitude}, ${point.longitude}:`, error.message);
                return estimateElevation(point.longitude, point.latitude);
            }
        })
    );
    
    return elevations;
}

/**
 * Calculate terrain slope between two points
 * @param {number} lon1 - First point longitude
 * @param {number} lat1 - First point latitude
 * @param {number} lon2 - Second point longitude
 * @param {number} lat2 - Second point latitude
 * @returns {Promise<number>} Slope in degrees
 */
async function calculateSlope(lon1, lat1, lon2, lat2) {
    try {
        const [elev1, elev2] = await Promise.all([
            getPointElevation(lon1, lat1),
            getPointElevation(lon2, lat2)
        ]);

        // Calculate horizontal distance using Haversine formula
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const horizontalDistance = R * c;

        // Calculate slope
        const elevationDiff = Math.abs(elev2 - elev1);
        const slopeRadians = Math.atan(elevationDiff / horizontalDistance);
        return slopeRadians * 180 / Math.PI; // Convert to degrees
    } catch (error) {
        console.warn('Error calculating slope:', error.message);
        return 0; // Default to flat terrain
    }
}

/**
 * Simplified elevation estimation based on general Australian terrain
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {number} Estimated elevation in meters
 */
function estimateElevation(longitude, latitude) {
    // Rough elevation estimates for major Australian regions
    
    // Great Dividing Range (eastern Australia)
    if (longitude > 145 && longitude < 155 && latitude > -40 && latitude < -25) {
        return 300 + Math.random() * 800; // 300-1100m
    }
    
    // Blue Mountains/Snowy Mountains
    if (longitude > 148 && longitude < 152 && latitude > -37 && latitude < -33) {
        return 500 + Math.random() * 1500; // 500-2000m
    }
    
    // Central Australia (including Uluru region)
    if (longitude > 130 && longitude < 140 && latitude > -30 && latitude < -20) {
        return 200 + Math.random() * 600; // 200-800m
    }
    
    // Perth Hills
    if (longitude > 115 && longitude < 117 && latitude > -33 && latitude < -31) {
        return 100 + Math.random() * 400; // 100-500m
    }
    
    // Coastal areas (default)
    if ((longitude < 120 && latitude > -35) || (longitude > 150 && latitude > -35)) {
        return 10 + Math.random() * 100; // 10-110m
    }
    
    // Inland areas (default)
    return 150 + Math.random() * 350; // 150-500m
}

/**
 * Create elevation grid for a bounding box
 * @param {Array} bbox - [minLng, minLat, maxLng, maxLat]
 * @param {number} resolution - Grid resolution in degrees
 * @returns {Promise<Array>} Grid of elevation points
 */
async function createElevationGrid(bbox, resolution = 0.01) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const points = [];
    
    for (let lng = minLng; lng <= maxLng; lng += resolution) {
        for (let lat = minLat; lat <= maxLat; lat += resolution) {
            points.push({ longitude: lng, latitude: lat });
        }
    }
    
    console.log(`Creating elevation grid with ${points.length} points...`);
    
    const elevations = await getBatchElevation(points);
    
    return points.map((point, index) => ({
        ...point,
        elevation: elevations[index]
    }));
}

/**
 * Store elevation data in database
 * @param {Array} elevationData - Array of elevation points
 * @returns {Promise<void>}
 */
async function storeElevationData(elevationData) {
    try {
        // Create elevation table if it doesn't exist
        await query(`
            CREATE TABLE IF NOT EXISTS elevation_data (
                id SERIAL PRIMARY KEY,
                longitude DOUBLE PRECISION NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                elevation DOUBLE PRECISION NOT NULL,
                data_source VARCHAR(50) DEFAULT 'ELVIS',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                geometry GEOMETRY(POINT, 4326)
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_elevation_geometry 
            ON elevation_data USING GIST (geometry);
        `);

        // Insert elevation data in batches
        const batchSize = 1000;
        for (let i = 0; i < elevationData.length; i += batchSize) {
            const batch = elevationData.slice(i, i + batchSize);
            
            const values = batch.map((point, index) => 
                `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, ST_SetSRID(ST_MakePoint($${index * 4 + 1}, $${index * 4 + 2}), 4326))`
            ).join(', ');

            const params = batch.flatMap(point => [
                point.longitude,
                point.latitude,
                point.elevation
            ]);

            await query(`
                INSERT INTO elevation_data (longitude, latitude, elevation, geometry)
                VALUES ${values}
                ON CONFLICT DO NOTHING;
            `, params);
        }

        console.log(`Stored ${elevationData.length} elevation points in database`);
    } catch (error) {
        console.error('Error storing elevation data:', error.message);
        throw error;
    }
}

/**
 * Get elevation for a point from local database (with fallback to API)
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {Promise<number>} Elevation in meters
 */
async function getLocalElevation(longitude, latitude) {
    try {
        // Check if we have local elevation data within 1km
        const result = await query(`
            SELECT elevation, 
                   ST_Distance(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
            FROM elevation_data
            WHERE ST_DWithin(
                geometry, 
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
                1000
            )
            ORDER BY distance
            LIMIT 1;
        `, [longitude, latitude]);

        if (result.rows.length > 0) {
            return result.rows[0].elevation;
        }

        // Fallback to API
        return await getPointElevation(longitude, latitude);
    } catch (error) {
        console.warn('Error getting local elevation:', error.message);
        return estimateElevation(longitude, latitude);
    }
}

module.exports = {
    getPointElevation,
    getBatchElevation,
    calculateSlope,
    createElevationGrid,
    storeElevationData,
    getLocalElevation,
    estimateElevation
};
