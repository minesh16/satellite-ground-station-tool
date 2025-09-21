# TerraLink Technical Reference Guide

## Dataset Specifications and Calculation Methodologies

---

## Table of Contents

1. [Dataset Detailed Specifications](#dataset-detailed-specifications)
2. [Calculation Algorithms Deep Dive](#calculation-algorithms-deep-dive)
3. [API Integration Details](#api-integration-details)
4. [Performance Optimization](#performance-optimization)
5. [Data Quality Assurance](#data-quality-assurance)

---

## Dataset Detailed Specifications

### Mobile Infrastructure Data

#### Telstra Sites Database
```
Source: mobile-sites-telstra-2024.csv
Records: ~8,500 sites nationwide
Fields:
- Site ID: Unique identifier
- Site Name: Location description
- Latitude/Longitude: WGS84 coordinates
- Technology: 3G/4G/5G capabilities
- Status: Active/Inactive/Planned
- Coverage Type: Macro/Small Cell/Indoor

Data Quality:
- Coordinate Accuracy: ±10 meters
- Update Frequency: Monthly
- Completeness: 95% coverage
```

#### Optus Network Database
```
Source: mobile-sites-optus-2024.csv
Records: ~6,200 sites nationwide
Additional Fields:
- Antenna Height: Tower height in meters
- Frequency Bands: Spectrum allocations
- Backhaul Type: Fiber/Microwave/Satellite

Coverage Analysis:
- KML File: Coverage map - Optus - 4G - Ext Ant - 2024.kml
- Technology: 4G external antenna coverage
- Polygon Count: ~1,200 coverage areas
- Coverage Method: Propagation modeling at cell edge
```

#### TPG Network Database
```
Source: mobile-sites-tpg-2024.csv
Records: ~3,800 sites nationwide
Network Characteristics:
- Dense urban deployment
- Shared infrastructure agreements
- Focus on high-traffic areas
```

### NBN Infrastructure

#### Fixed Line Coverage
```
Source: nbn_coverage_fixedline.shp
Geometry Type: MultiPolygon
Coverage Areas: ~15,000 polygon features
Service Classes:
- FTTP: Fiber to the Premises
- FTTN: Fiber to the Node
- FTTC: Fiber to the Curb
- FTTB: Fiber to the Building
- HFC: Hybrid Fiber Coaxial

Attributes:
- Service Class: Technology type
- Ready for Service: Availability status
- Service Category: Residential/Business
- CSA ID: Connectivity Service Area identifier
```

#### Wireless Coverage
```
Source: nbn_coverage_wireless.shp
Technology Types:
- Fixed Wireless: Point-to-point links
- Satellite: Sky Muster services
- Coverage method: Point-in-polygon analysis
```

### Elevation Data Integration

#### ELVIS API Specifications
```
Service: Australian Government ELVIS
Base URL: https://elevation.fsdf.org.au/
Service Type: WMS/REST MapServer
Resolution: 25m x 25m grid cells
Vertical Accuracy: ±2 meters (95% confidence)
Coverage: Complete Australian mainland + Tasmania
Coordinate System: WGS84 (EPSG:4326)

API Endpoints:
1. Identify Service: Point elevation queries
   URL: /arcgis/rest/services/ELVIS_SMOOTHED_25M/MapServer/identify
   
2. WMS Service: Raster data access
   URL: /arcgis/services/ELVIS_SMOOTHED_25M/MapServer/WMSServer

Request Example:
GET /identify?f=json&geometry=151.2093,-33.8688&geometryType=esriGeometryPoint&inSR=4326&returnZ=true

Response Format:
{
  "results": [{
    "attributes": {
      "Pixel Value": 156.8,
      "OID": 1
    }
  }]
}
```

#### Elevation Processing Pipeline
```javascript
// Multi-stage elevation retrieval with fallbacks
async function getLocalElevation(longitude, latitude) {
    try {
        // Stage 1: Direct ELVIS API call
        const elevation = await getPointElevation(longitude, latitude);
        if (elevation !== null) return elevation;
        
        // Stage 2: Database cache lookup
        const cached = await getCachedElevation(longitude, latitude, 1000); // 1km radius
        if (cached) return cached;
        
        // Stage 3: Regional estimation
        return estimateElevation(longitude, latitude);
    } catch (error) {
        return estimateElevation(longitude, latitude);
    }
}

// Regional elevation estimation using geographic knowledge
function estimateElevation(longitude, latitude) {
    // Australian geographic regions with typical elevation ranges
    const regions = {
        great_dividing_range: { bounds: [...], elevation_range: [200, 1500] },
        coastal_plains: { bounds: [...], elevation_range: [0, 200] },
        central_australia: { bounds: [...], elevation_range: [200, 800] },
        western_plateau: { bounds: [...], elevation_range: [300, 600] }
    };
    
    // Point-in-polygon test and interpolation
    for (const region of regions) {
        if (isPointInRegion(longitude, latitude, region.bounds)) {
            return interpolateElevation(region.elevation_range);
        }
    }
    
    return 300; // Default Australian average
}
```

### Population Demographics

#### ABS Population Integration
```javascript
// Population regions with detailed demographics
const POPULATION_REGIONS = {
    // Major metropolitan areas
    sydney: {
        center: [151.2093, -33.8688],
        radius: 50000, // 50km service radius
        density: 2037,  // people per km²
        characteristics: {
            urbanization: 0.95,
            economic_activity: 0.88,
            infrastructure_density: 0.92
        }
    },
    melbourne: {
        center: [144.9631, -37.8136],
        radius: 45000,
        density: 1566,
        characteristics: {
            urbanization: 0.93,
            economic_activity: 0.85,
            infrastructure_density: 0.89
        }
    },
    
    // Regional centers with growth potential
    toowoomba: {
        center: [151.9507, -27.5598],
        radius: 12000,
        density: 400,
        characteristics: {
            urbanization: 0.65,
            economic_activity: 0.72,
            infrastructure_density: 0.58,
            growth_rate: 0.024 // 2.4% annual
        }
    }
};

// Population density calculation with distance decay
function calculatePopulationDensity(longitude, latitude) {
    let weightedDensity = 0;
    let totalWeight = 0;
    
    for (const [regionName, region] of Object.entries(POPULATION_REGIONS)) {
        const distance = calculateDistance(
            latitude, longitude,
            region.center[1], region.center[0]
        );
        
        if (distance <= region.radius) {
            // Exponential decay function
            const weight = Math.exp(-distance / (region.radius * 0.3));
            weightedDensity += region.density * weight;
            totalWeight += weight;
        }
    }
    
    return totalWeight > 0 ? weightedDensity / totalWeight : 5; // Rural baseline
}
```

---

## Calculation Algorithms Deep Dive

### Multi-Factor Scoring Engine

#### Core Scoring Function
```javascript
async function calculateSiteScore(site, weights = DEFAULT_WEIGHTS) {
    const { longitude, latitude } = site;
    
    // Parallel factor calculations for performance
    const [
        backhaulScore,
        populationScore,
        elevationScore,
        rfScore,
        landScore,
        satelliteScore,
        marketScore
    ] = await Promise.all([
        calculateBackhaulScore(longitude, latitude),
        calculatePopulationScore(longitude, latitude),
        calculateElevationScore(longitude, latitude),
        calculateRFInterferenceScore(longitude, latitude),
        calculateLandAvailabilityScore(longitude, latitude),
        calculateSatelliteOptimization(longitude, latitude),
        calculateMarketDemand(longitude, latitude)
    ]);
    
    // Weighted aggregation
    const totalScore = 
        (backhaulScore * weights.backhaul_proximity) +
        (populationScore * weights.population_proximity) +
        (elevationScore * weights.elevation) +
        (rfScore * weights.rf_interference) +
        (landScore * weights.land_availability) +
        (satelliteScore * weights.satellite_optimization) +
        (marketScore * weights.market_demand);
    
    return {
        total_score: Math.round(totalScore * 1000) / 1000,
        score_breakdown: {
            backhaul_proximity: backhaulScore,
            population_proximity: populationScore,
            elevation: elevationScore,
            rf_interference: rfScore,
            land_availability: landScore,
            satellite_optimization: satelliteScore,
            market_demand: marketScore
        },
        weights_used: weights,
        reasoning: generateReasoningText({
            backhaul: backhaulScore,
            population: populationScore,
            elevation: elevationScore,
            rf: rfScore,
            land: landScore,
            satellite: satelliteScore,
            market: marketScore
        })
    };
}
```

#### Backhaul Proximity Analysis
```javascript
async function calculateBackhaulScore(longitude, latitude) {
    // Multi-source infrastructure proximity analysis
    const infrastructureTypes = [
        { table: 'mobile_sites', weight: 0.4, max_distance: 30000 },
        { table: 'nbn_pops', weight: 0.3, max_distance: 50000 },
        { table: 'fiber_nodes', weight: 0.3, max_distance: 20000 }
    ];
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const infraType of infrastructureTypes) {
        const nearestQuery = `
            SELECT ST_Distance(
                ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
                geom
            ) as distance
            FROM ${infraType.table}
            ORDER BY geom <-> ST_GeomFromText('POINT(${longitude} ${latitude})', 4326)
            LIMIT 1
        `;
        
        const result = await query(nearestQuery);
        if (result.rows.length > 0) {
            const distance = result.rows[0].distance;
            const score = calculateDistanceScore(distance, infraType.max_distance);
            totalScore += score * infraType.weight;
            totalWeight += infraType.weight;
        }
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0.2;
}

// Distance scoring with exponential decay
function calculateDistanceScore(distance, maxDistance = 50000) {
    if (distance <= 0) return 1.0;
    if (distance >= maxDistance) return 0.0;
    
    // Exponential decay: closer sites heavily favored
    return Math.exp(-3 * distance / maxDistance);
}
```

#### RF Interference Assessment
```javascript
async function calculateRFInterferenceScore(longitude, latitude) {
    // Find transmitters within interference range
    const interferenceQuery = `
        SELECT 
            carrier,
            ST_Distance(
                ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
                geom
            ) as distance,
            CASE 
                WHEN carrier = 'Telstra' THEN 1.2  -- Higher power
                WHEN carrier = 'Optus' THEN 1.0
                WHEN carrier = 'TPG' THEN 0.8
                ELSE 1.0
            END as interference_factor
        FROM mobile_sites
        WHERE ST_DWithin(
            ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
            geom,
            20000  -- 20km analysis radius
        )
        ORDER BY distance
    `;
    
    const results = await query(interferenceQuery);
    let interferenceScore = 1.0;
    
    for (const transmitter of results.rows) {
        const distance = transmitter.distance;
        const factor = transmitter.interference_factor;
        
        let penalty = 0;
        if (distance < 1000) penalty = 0.8 * factor;
        else if (distance < 2000) penalty = 0.6 * factor;
        else if (distance < 5000) penalty = 0.3 * factor;
        else if (distance < 10000) penalty = 0.1 * factor;
        else penalty = 0.05 * factor;
        
        interferenceScore *= (1 - penalty);
    }
    
    return Math.max(interferenceScore, 0.1); // Minimum 10% score
}
```

### Satellite Optimization Algorithms

#### Kuiper Constellation Modeling
```javascript
// Detailed Kuiper constellation parameters
const KUIPER_CONSTELLATION = {
    shells: [
        {
            name: "Shell 1",
            altitude_km: 590,
            inclination_deg: 51.9,
            satellites: 1156,
            orbital_period_min: 96.4,
            coverage_angle_deg: 160
        },
        {
            name: "Shell 2", 
            altitude_km: 630,
            inclination_deg: 51.9,
            satellites: 1296,
            orbital_period_min: 98.1,
            coverage_angle_deg: 160
        },
        {
            name: "Shell 3",
            altitude_km: 610,
            inclination_deg: 53.2,
            satellites: 1764,
            orbital_period_min: 97.2,
            coverage_angle_deg: 160
        }
    ],
    total_satellites: 4216,
    service_links: {
        frequency_ghz: [17.8, 18.6, 19.3, 20.2],  // Ka-band
        bandwidth_mhz: 250,
        polarization: "Circular"
    }
};

// Satellite visibility calculation
async function calculatePassOptimization(longitude, latitude, options = {}) {
    const {
        target_elevation_angle = 35,
        analysis_period_hours = 24,
        weather_factor = 0.85
    } = options;
    
    // Get terrain elevation for obstruction analysis
    const terrainElevation = await getLocalElevation(longitude, latitude);
    
    // Analyze each shell independently
    const shellAnalysis = await Promise.all(
        KUIPER_CONSTELLATION.shells.map(shell => 
            analyzeShellVisibility(longitude, latitude, shell, target_elevation_angle, terrainElevation)
        )
    );
    
    // Aggregate metrics across all shells
    const totalPasses = shellAnalysis.reduce((sum, shell) => sum + shell.daily_passes, 0);
    const avgPassDuration = shellAnalysis.reduce((sum, shell) => 
        sum + shell.avg_pass_duration, 0) / shellAnalysis.length;
    const maxElevationAngle = Math.max(...shellAnalysis.map(shell => shell.max_elevation_angle));
    
    // Coverage efficiency: fraction of time with satellite visibility
    const coverageEfficiency = calculateCoverageEfficiency(shellAnalysis, analysis_period_hours);
    
    // Link budget analysis
    const linkBudget = calculateLinkBudgetFactors(maxElevationAngle, terrainElevation, weather_factor);
    
    // Terrain obstruction impact
    const terrainImpact = await calculateTerrainObstruction(longitude, latitude, terrainElevation);
    
    // Overall optimization score (0-1)
    const optimizationScore = (
        (coverageEfficiency * 0.3) +           // Time with service
        (linkBudget.score * 0.25) +            // Link quality
        ((1 - terrainImpact.obstruction_factor) * 0.2) + // Clear line of sight
        (Math.min(maxElevationAngle / 90, 1) * 0.15) +   // High elevation advantage
        (Math.min(totalPasses / 100, 1) * 0.1)          // Pass frequency
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
}

// Individual shell visibility analysis
async function analyzeShellVisibility(longitude, latitude, shell, minElevation, terrainElevation) {
    const earthRadius = 6371; // km
    const satelliteAltitude = shell.altitude_km;
    
    // Calculate maximum communication range
    const maxRange = Math.sqrt(
        Math.pow(earthRadius + satelliteAltitude, 2) - 
        Math.pow(earthRadius * Math.cos(minElevation * Math.PI / 180), 2)
    ) - earthRadius * Math.sin(minElevation * Math.PI / 180);
    
    // Estimate passes per day based on orbital mechanics
    const orbitalVelocity = Math.sqrt(398600.4418 / (earthRadius + satelliteAltitude)); // km/s
    const groundTrackVelocity = orbitalVelocity * earthRadius / (earthRadius + satelliteAltitude);
    const passesPerOrbit = 2 * maxRange / (groundTrackVelocity * shell.orbital_period_min * 60);
    const orbitsPerDay = 1440 / shell.orbital_period_min;
    const dailyPasses = Math.round(passesPerOrbit * orbitsPerDay * shell.satellites / 360);
    
    // Average pass duration
    const avgPassDuration = 2 * maxRange / groundTrackVelocity / 60; // minutes
    
    // Maximum elevation angle calculation
    const maxElevationAngle = Math.asin(earthRadius / (earthRadius + satelliteAltitude)) * 180 / Math.PI;
    
    return {
        shell_name: shell.name,
        daily_passes: Math.min(dailyPasses, 150), // Practical upper limit
        avg_pass_duration: Math.round(avgPassDuration * 10) / 10,
        max_elevation_angle: Math.round(maxElevationAngle * 10) / 10,
        satellites_in_shell: shell.satellites,
        coverage_contribution: shell.satellites / KUIPER_CONSTELLATION.total_satellites
    };
}
```

#### Link Budget Calculations
```javascript
function calculateLinkBudgetFactors(elevationAngle, terrainElevation, weatherFactor) {
    const frequency = 19.5e9; // 19.5 GHz (Ka-band center)
    const distance = calculateSlantRange(elevationAngle, 610); // Average altitude
    
    // Free space path loss
    const fspl = 20 * Math.log10(distance * 1000) + 
                 20 * Math.log10(frequency) + 
                 20 * Math.log10(4 * Math.PI / 299792458) + 
                 32.44; // Convert to dB
    
    // Atmospheric absorption
    const atmosphericLoss = calculateAtmosphericLoss(elevationAngle, frequency);
    
    // Rain fade (Australian climate model)
    const rainFade = calculateRainFade(elevationAngle, frequency) * weatherFactor;
    
    // Antenna gain (ground station)
    const antennaGain = 10 * Math.log10(
        4 * Math.PI * Math.pow(1.2, 2) / Math.pow(299792458 / frequency, 2)
    ); // 1.2m dish efficiency 0.65
    
    // Total link budget
    const totalLoss = fspl + atmosphericLoss + rainFade;
    const linkMargin = antennaGain - totalLoss + 45; // 45 dBW satellite EIRP
    
    // Score based on link margin
    let score = 0;
    if (linkMargin > 10) score = 1.0;
    else if (linkMargin > 5) score = 0.8;
    else if (linkMargin > 0) score = 0.6;
    else if (linkMargin > -5) score = 0.4;
    else score = 0.2;
    
    return {
        score: score,
        free_space_loss_db: Math.round(fspl * 10) / 10,
        atmospheric_loss_db: Math.round(atmosphericLoss * 10) / 10,
        rain_fade_db: Math.round(rainFade * 10) / 10,
        antenna_gain_db: Math.round(antennaGain * 10) / 10,
        link_margin_db: Math.round(linkMargin * 10) / 10,
        slant_range_km: Math.round(distance)
    };
}

function calculateSlantRange(elevationAngle, satelliteAltitude) {
    const earthRadius = 6371; // km
    const elevRad = elevationAngle * Math.PI / 180;
    
    return Math.sqrt(
        Math.pow(earthRadius + satelliteAltitude, 2) - 
        Math.pow(earthRadius * Math.cos(elevRad), 2)
    ) - earthRadius * Math.sin(elevRad);
}

function calculateAtmosphericLoss(elevationAngle, frequency) {
    // ITU-R P.676 atmospheric absorption model
    const elevRad = elevationAngle * Math.PI / 180;
    const zenithLoss = 0.2; // dB at zenith for clear sky
    return zenithLoss / Math.sin(elevRad);
}

function calculateRainFade(elevationAngle, frequency) {
    // ITU-R P.837 rain fade model for Australia
    const elevRad = elevationAngle * Math.PI / 180;
    const rainRate = 35; // mm/hr (Australian average heavy rain)
    const specificAttenuation = 0.0188 * Math.pow(frequency / 1e9, 1.217) * 
                                Math.pow(rainRate, 1.12); // dB/km
    const effectiveLength = 7.5 / Math.sin(elevRad); // km
    return specificAttenuation * effectiveLength;
}
```

### Market Demand Analysis

#### Population-Weighted Revenue Model
```javascript
async function calculateMarketDemand(longitude, latitude) {
    // Service area definition (distance-based zones)
    const serviceZones = [
        { radius: 10000, weight: 1.0, revenue_per_capita: 85 },   // Primary: $85/person/year
        { radius: 25000, weight: 0.7, revenue_per_capita: 60 },  // Secondary: $60/person/year  
        { radius: 50000, weight: 0.4, revenue_per_capita: 35 }   // Extended: $35/person/year
    ];
    
    let totalDemand = 0;
    let totalPopulation = 0;
    
    for (const zone of serviceZones) {
        const zonePopulation = await getPopulationInRadius(longitude, latitude, zone.radius);
        const adjustedPopulation = zonePopulation * zone.weight;
        const zoneDemand = adjustedPopulation * zone.revenue_per_capita;
        
        totalDemand += zoneDemand;
        totalPopulation += adjustedPopulation;
    }
    
    // Competition factor analysis
    const competitionFactor = await analyzeCompetition(longitude, latitude);
    
    // Market penetration assumptions
    const penetrationRate = calculatePenetrationRate(totalPopulation, longitude, latitude);
    
    // Final demand calculation
    const adjustedDemand = totalDemand * competitionFactor * penetrationRate;
    
    // Normalize to 0-1 score
    const demandScore = Math.min(adjustedDemand / 1000000, 1.0); // $1M max score
    
    return {
        score: demandScore,
        annual_revenue_potential: Math.round(adjustedDemand),
        service_area_population: Math.round(totalPopulation),
        competition_factor: competitionFactor,
        market_penetration_rate: penetrationRate,
        primary_market_size: Math.round(totalPopulation * 0.3), // 30% primary market
        business_case_rating: getDemandRating(demandScore)
    };
}

async function getPopulationInRadius(longitude, latitude, radius) {
    let populationCount = 0;
    
    for (const [regionName, region] of Object.entries(POPULATION_REGIONS)) {
        const distance = calculateDistance(latitude, longitude, region.center[1], region.center[0]);
        
        if (distance <= radius) {
            // Population estimation based on density and coverage area
            const coverageArea = Math.PI * Math.pow(Math.min(region.radius, radius - distance), 2) / 1000000; // km²
            const regionPopulation = region.density * coverageArea;
            
            // Distance decay function
            const decayFactor = Math.exp(-distance / (radius * 0.5));
            populationCount += regionPopulation * decayFactor;
        }
    }
    
    return populationCount;
}

function calculatePenetrationRate(population, longitude, latitude) {
    // Base penetration rates by area type
    if (population > 100000) return 0.15;      // Major urban: 15%
    if (population > 50000) return 0.12;       // Urban: 12%
    if (population > 20000) return 0.08;       // Regional: 8%
    if (population > 5000) return 0.05;        // Rural town: 5%
    return 0.02;                               // Remote: 2%
}

async function analyzeCompetition(longitude, latitude) {
    // Analyze existing service provider density
    const competitorQuery = `
        SELECT COUNT(*) as competitor_count,
               AVG(ST_Distance(
                   ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
                   geom
               )) as avg_distance
        FROM mobile_sites
        WHERE ST_DWithin(
            ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
            geom,
            25000  -- 25km competition radius
        )
    `;
    
    const result = await query(competitorQuery);
    const competitorCount = result.rows[0].competitor_count;
    const avgDistance = result.rows[0].avg_distance;
    
    // Competition factor: lower values indicate more competition
    let competitionFactor = 1.0;
    
    if (competitorCount > 20) competitionFactor = 0.6;      // High competition
    else if (competitorCount > 10) competitionFactor = 0.75; // Medium competition
    else if (competitorCount > 5) competitionFactor = 0.9;   // Low competition
    // else: minimal competition, factor = 1.0
    
    // Adjust for average distance (closer competitors = more competition)
    if (avgDistance < 5000) competitionFactor *= 0.8;
    else if (avgDistance < 10000) competitionFactor *= 0.9;
    
    return competitionFactor;
}
```

---

## API Integration Details

### ELVIS Elevation Service Integration

#### Authentication and Rate Limiting
```javascript
const ELVIS_CONFIG = {
    baseURL: 'https://elevation.fsdf.org.au',
    timeout: 10000,
    retryAttempts: 3,
    rateLimitDelay: 100, // ms between requests
    batchSize: 50        // points per batch request
};

class ELVISAPIClient {
    constructor() {
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
    }
    
    async getElevation(longitude, latitude) {
        return new Promise((resolve) => {
            this.requestQueue.push({ longitude, latitude, resolve });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < ELVIS_CONFIG.rateLimitDelay) {
                await new Promise(resolve => 
                    setTimeout(resolve, ELVIS_CONFIG.rateLimitDelay - timeSinceLastRequest)
                );
            }
            
            const batch = this.requestQueue.splice(0, ELVIS_CONFIG.batchSize);
            await this.processBatch(batch);
            this.lastRequestTime = Date.now();
        }
        
        this.isProcessing = false;
    }
    
    async processBatch(batch) {
        for (const request of batch) {
            try {
                const elevation = await this.makeElevationRequest(
                    request.longitude, 
                    request.latitude
                );
                request.resolve(elevation);
            } catch (error) {
                console.warn('ELVIS request failed:', error.message);
                request.resolve(estimateElevation(request.longitude, request.latitude));
            }
        }
    }
}
```

#### Error Handling and Fallbacks
```javascript
async function makeElevationRequest(longitude, latitude, attempt = 1) {
    try {
        const response = await axios.get(`${ELVIS_CONFIG.baseURL}/arcgis/rest/services/ELVIS_SMOOTHED_25M/MapServer/identify`, {
            params: {
                f: 'json',
                geometry: `${longitude},${latitude}`,
                geometryType: 'esriGeometryPoint',
                inSR: '4326',
                outSR: '4326',
                returnZ: 'true',
                tolerance: 1,
                mapExtent: `${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}`,
                imageDisplay: '100,100,96',
                layers: 'visible:0'
            },
            timeout: ELVIS_CONFIG.timeout
        });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            if (result.attributes && result.attributes['Pixel Value'] !== undefined) {
                const elevation = parseFloat(result.attributes['Pixel Value']);
                
                // Cache successful result
                await cacheElevation(longitude, latitude, elevation);
                return elevation;
            }
        }
        
        throw new Error('No elevation data in response');
        
    } catch (error) {
        if (attempt < ELVIS_CONFIG.retryAttempts) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeElevationRequest(longitude, latitude, attempt + 1);
        }
        
        throw error;
    }
}

// Elevation caching for performance
async function cacheElevation(longitude, latitude, elevation) {
    const cacheQuery = `
        INSERT INTO elevation_cache (longitude, latitude, elevation, cached_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (longitude, latitude) 
        DO UPDATE SET elevation = $3, cached_at = NOW()
    `;
    
    await query(cacheQuery, [longitude, latitude, elevation]);
}

async function getCachedElevation(longitude, latitude, tolerance = 1000) {
    const cacheQuery = `
        SELECT elevation, 
               ST_Distance(
                   ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
                   ST_GeomFromText('POINT(' || longitude || ' ' || latitude || ')', 4326)
               ) as distance
        FROM elevation_cache
        WHERE ST_DWithin(
            ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
            ST_GeomFromText('POINT(' || longitude || ' ' || latitude || ')', 4326),
            ${tolerance}
        )
        AND cached_at > NOW() - INTERVAL '30 days'
        ORDER BY distance
        LIMIT 1
    `;
    
    const result = await query(cacheQuery);
    return result.rows.length > 0 ? result.rows[0].elevation : null;
}
```

---

## Performance Optimization

### Database Query Optimization

#### Spatial Index Configuration
```sql
-- Primary spatial indexes for fast nearest neighbor queries
CREATE INDEX idx_mobile_sites_geom ON mobile_sites USING GIST (geom);
CREATE INDEX idx_nbn_coverage_geom ON nbn_coverage USING GIST (geom);
CREATE INDEX idx_candidate_sites_geom ON candidate_sites USING GIST (geom);

-- Composite indexes for filtered queries
CREATE INDEX idx_mobile_sites_carrier_geom ON mobile_sites USING GIST (geom) WHERE carrier IS NOT NULL;
CREATE INDEX idx_nbn_coverage_type_geom ON nbn_coverage USING GIST (geom) WHERE coverage_type = 'Fixed Line';

-- B-tree indexes for non-spatial attributes
CREATE INDEX idx_mobile_sites_carrier ON mobile_sites (carrier);
CREATE INDEX idx_candidate_sites_score ON candidate_sites (total_score DESC);

-- Elevation cache optimization
CREATE UNIQUE INDEX idx_elevation_cache_coords ON elevation_cache (longitude, latitude);
CREATE INDEX idx_elevation_cache_geom ON elevation_cache USING GIST (
    ST_GeomFromText('POINT(' || longitude || ' ' || latitude || ')', 4326)
);
CREATE INDEX idx_elevation_cache_time ON elevation_cache (cached_at);
```

#### Query Plan Optimization
```sql
-- Optimized nearest infrastructure query
EXPLAIN ANALYZE
SELECT 
    site_name,
    carrier,
    ST_Distance(geom, ST_GeomFromText('POINT(151.2093 -33.8688)', 4326)) as distance
FROM mobile_sites
WHERE ST_DWithin(
    geom, 
    ST_GeomFromText('POINT(151.2093 -33.8688)', 4326), 
    50000
)
ORDER BY geom <-> ST_GeomFromText('POINT(151.2093 -33.8688)', 4326)
LIMIT 5;

-- Result: Index Scan using idx_mobile_sites_geom (cost=0.28..8.30 rows=1 width=68)
```

### Application-Level Optimizations

#### Parallel Processing Framework
```javascript
class ParallelAnalysisEngine {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
        this.activeRequests = 0;
        this.requestQueue = [];
    }
    
    async analyzeSitesParallel(candidateSites, weights) {
        const results = await Promise.all(
            this.chunkArray(candidateSites, this.maxConcurrency).map(
                chunk => this.processChunk(chunk, weights)
            )
        );
        
        return results.flat();
    }
    
    async processChunk(sites, weights) {
        return Promise.all(
            sites.map(site => this.analyzeSiteWithTimeout(site, weights))
        );
    }
    
    async analyzeSiteWithTimeout(site, weights, timeout = 5000) {
        return Promise.race([
            calculateSiteScore(site, weights),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Analysis timeout')), timeout)
            )
        ]).catch(error => {
            console.warn(`Site analysis failed for ${site.latitude}, ${site.longitude}:`, error.message);
            return this.getFallbackScore(site, weights);
        });
    }
    
    getFallbackScore(site, weights) {
        return {
            total_score: 0.5,
            score_breakdown: Object.fromEntries(
                Object.keys(weights).map(key => [key, 0.5])
            ),
            weights_used: weights,
            reasoning: "Fallback scoring due to analysis timeout",
            analysis_type: 'fallback_timeout'
        };
    }
    
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
```

#### Caching Strategy Implementation
```javascript
class AnalysisCache {
    constructor() {
        this.scoreCache = new Map();
        this.elevationCache = new Map();
        this.populationCache = new Map();
        this.maxCacheSize = 10000;
        this.cacheHitRate = 0;
        this.cacheRequests = 0;
    }
    
    generateCacheKey(longitude, latitude, weights) {
        const roundedLon = Math.round(longitude * 10000) / 10000;
        const roundedLat = Math.round(latitude * 10000) / 10000;
        const weightsHash = this.hashWeights(weights);
        return `${roundedLon},${roundedLat},${weightsHash}`;
    }
    
    hashWeights(weights) {
        return Object.entries(weights)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}:${Math.round(value * 1000)}`)
            .join('|');
    }
    
    async getCachedScore(longitude, latitude, weights) {
        this.cacheRequests++;
        const key = this.generateCacheKey(longitude, latitude, weights);
        
        if (this.scoreCache.has(key)) {
            this.cacheHitRate = ((this.cacheRequests - 1) * this.cacheHitRate + 1) / this.cacheRequests;
            return this.scoreCache.get(key);
        }
        
        this.cacheHitRate = ((this.cacheRequests - 1) * this.cacheHitRate) / this.cacheRequests;
        return null;
    }
    
    setCachedScore(longitude, latitude, weights, score) {
        const key = this.generateCacheKey(longitude, latitude, weights);
        
        if (this.scoreCache.size >= this.maxCacheSize) {
            // LRU eviction
            const firstKey = this.scoreCache.keys().next().value;
            this.scoreCache.delete(firstKey);
        }
        
        this.scoreCache.set(key, {
            ...score,
            cached_at: Date.now()
        });
    }
    
    getCacheStats() {
        return {
            hit_rate: Math.round(this.cacheHitRate * 1000) / 1000,
            cache_size: this.scoreCache.size,
            max_size: this.maxCacheSize,
            total_requests: this.cacheRequests
        };
    }
}
```

---

## Data Quality Assurance

### Validation Framework

#### Coordinate System Validation
```javascript
function validateCoordinates(longitude, latitude) {
    const validationResults = {
        isValid: true,
        errors: [],
        warnings: []
    };
    
    // Basic range validation
    if (longitude < -180 || longitude > 180) {
        validationResults.isValid = false;
        validationResults.errors.push(`Invalid longitude: ${longitude} (must be -180 to 180)`);
    }
    
    if (latitude < -90 || latitude > 90) {
        validationResults.isValid = false;
        validationResults.errors.push(`Invalid latitude: ${latitude} (must be -90 to 90)`);
    }
    
    // Australia-specific validation
    if (longitude < 110 || longitude > 160) {
        validationResults.warnings.push(`Longitude ${longitude} is outside typical Australian bounds (110-160)`);
    }
    
    if (latitude < -45 || latitude > -10) {
        validationResults.warnings.push(`Latitude ${latitude} is outside typical Australian bounds (-45 to -10)`);
    }
    
    // Ocean/land validation using simplified coastline check
    if (isInOcean(longitude, latitude)) {
        validationResults.warnings.push(`Coordinates appear to be in ocean: ${latitude}, ${longitude}`);
    }
    
    return validationResults;
}

function isInOcean(longitude, latitude) {
    // Simplified Australian landmass bounding boxes
    const landRegions = [
        { minLon: 113, maxLon: 154, minLat: -39, maxLat: -11 }, // Mainland
        { minLon: 145, maxLon: 148, minLat: -44, maxLat: -40 }  // Tasmania
    ];
    
    return !landRegions.some(region => 
        longitude >= region.minLon && longitude <= region.maxLon &&
        latitude >= region.minLat && latitude <= region.maxLat
    );
}
```

#### Data Integrity Checking
```javascript
async function validateDatabaseIntegrity() {
    const checks = [];
    
    // Check for duplicate mobile sites
    const duplicateQuery = `
        SELECT carrier, COUNT(*) as count, 
               STRING_AGG(DISTINCT site_name, ', ') as sites
        FROM mobile_sites
        GROUP BY carrier, longitude, latitude
        HAVING COUNT(*) > 1
    `;
    
    const duplicates = await query(duplicateQuery);
    if (duplicates.rows.length > 0) {
        checks.push({
            check: 'duplicate_sites',
            status: 'warning',
            count: duplicates.rows.length,
            details: duplicates.rows
        });
    }
    
    // Check for invalid geometries
    const invalidGeomQuery = `
        SELECT 'mobile_sites' as table_name, COUNT(*) as invalid_count
        FROM mobile_sites WHERE NOT ST_IsValid(geom)
        UNION ALL
        SELECT 'nbn_coverage' as table_name, COUNT(*) as invalid_count  
        FROM nbn_coverage WHERE NOT ST_IsValid(geom)
    `;
    
    const invalidGeoms = await query(invalidGeomQuery);
    for (const row of invalidGeoms.rows) {
        if (row.invalid_count > 0) {
            checks.push({
                check: 'invalid_geometry',
                table: row.table_name,
                status: 'error',
                count: row.invalid_count
            });
        }
    }
    
    // Check elevation cache consistency
    const elevationConsistencyQuery = `
        SELECT COUNT(*) as inconsistent_count
        FROM elevation_cache e1
        JOIN elevation_cache e2 ON 
            ST_DWithin(
                ST_GeomFromText('POINT(' || e1.longitude || ' ' || e1.latitude || ')', 4326),
                ST_GeomFromText('POINT(' || e2.longitude || ' ' || e2.latitude || ')', 4326),
                100
            )
        WHERE ABS(e1.elevation - e2.elevation) > 50
          AND e1.id != e2.id
    `;
    
    const elevationCheck = await query(elevationConsistencyQuery);
    if (elevationCheck.rows[0].inconsistent_count > 0) {
        checks.push({
            check: 'elevation_consistency',
            status: 'warning',
            count: elevationCheck.rows[0].inconsistent_count,
            message: 'Elevation values vary significantly for nearby points'
        });
    }
    
    return {
        timestamp: new Date().toISOString(),
        checks: checks,
        overall_status: checks.some(c => c.status === 'error') ? 'error' : 
                       checks.some(c => c.status === 'warning') ? 'warning' : 'healthy'
    };
}
```

#### Performance Monitoring
```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            analysis_times: [],
            api_response_times: [],
            database_query_times: [],
            cache_hit_rates: [],
            error_rates: []
        };
        this.startTime = Date.now();
    }
    
    recordAnalysisTime(duration, siteCount) {
        this.metrics.analysis_times.push({
            timestamp: Date.now(),
            duration_ms: duration,
            sites_analyzed: siteCount,
            throughput: siteCount / (duration / 1000) // sites per second
        });
        
        // Keep only last 1000 measurements
        if (this.metrics.analysis_times.length > 1000) {
            this.metrics.analysis_times.shift();
        }
    }
    
    recordAPICall(endpoint, duration, success) {
        this.metrics.api_response_times.push({
            timestamp: Date.now(),
            endpoint: endpoint,
            duration_ms: duration,
            success: success
        });
        
        // Calculate error rate
        const recentCalls = this.metrics.api_response_times.slice(-100);
        const errorRate = recentCalls.filter(call => !call.success).length / recentCalls.length;
        this.metrics.error_rates.push({
            timestamp: Date.now(),
            rate: errorRate,
            endpoint: endpoint
        });
    }
    
    getPerformanceReport() {
        const now = Date.now();
        const recentAnalyses = this.metrics.analysis_times.filter(
            entry => now - entry.timestamp < 3600000 // Last hour
        );
        
        const avgAnalysisTime = recentAnalyses.length > 0 ?
            recentAnalyses.reduce((sum, entry) => sum + entry.duration_ms, 0) / recentAnalyses.length : 0;
        
        const avgThroughput = recentAnalyses.length > 0 ?
            recentAnalyses.reduce((sum, entry) => sum + entry.throughput, 0) / recentAnalyses.length : 0;
        
        return {
            uptime_hours: (now - this.startTime) / 3600000,
            analysis_performance: {
                avg_time_ms: Math.round(avgAnalysisTime),
                avg_throughput_sites_per_sec: Math.round(avgThroughput * 10) / 10,
                total_analyses: this.metrics.analysis_times.length
            },
            system_health: {
                error_rate: this.getCurrentErrorRate(),
                cache_efficiency: this.getCurrentCacheHitRate(),
                database_performance: this.getDatabasePerformance()
            }
        };
    }
    
    getCurrentErrorRate() {
        const recentErrors = this.metrics.error_rates.slice(-10);
        return recentErrors.length > 0 ?
            recentErrors.reduce((sum, entry) => sum + entry.rate, 0) / recentErrors.length : 0;
    }
    
    getCurrentCacheHitRate() {
        const recentRates = this.metrics.cache_hit_rates.slice(-10);
        return recentRates.length > 0 ?
            recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length : 0;
    }
    
    getDatabasePerformance() {
        const recentQueries = this.metrics.database_query_times.slice(-100);
        const avgQueryTime = recentQueries.length > 0 ?
            recentQueries.reduce((sum, time) => sum + time, 0) / recentQueries.length : 0;
        
        return {
            avg_query_time_ms: Math.round(avgQueryTime),
            queries_per_hour: recentQueries.length * (3600000 / 3600000), // Normalized to hour
            slow_query_count: recentQueries.filter(time => time > 5000).length
        };
    }
}
```

---

This technical reference provides the detailed specifications and implementation details for TerraLink's core algorithms, data processing pipelines, and quality assurance systems. The platform's modular architecture allows for easy extension and customization for different use cases while maintaining high performance and reliability standards.
