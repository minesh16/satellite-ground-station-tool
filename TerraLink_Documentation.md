# TerraLink - Advanced Location Intelligence & Analysis Platform

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Input Datasets](#input-datasets)
4. [Analysis Methodology](#analysis-methodology)
5. [Calculation Algorithms](#calculation-algorithms)
6. [API Reference](#api-reference)
7. [User Interface](#user-interface)
8. [Installation & Setup](#installation--setup)
9. [Usage Examples](#usage-examples)
10. [Advanced Features](#advanced-features)

---

## Overview

TerraLink is a sophisticated geospatial analysis platform designed for optimal site placement decisions using multi-factor intelligence. Originally developed for Amazon Kuiper satellite ground station optimization, the platform provides comprehensive location analysis capabilities for telecommunications infrastructure, renewable energy sites, and other strategic facility planning.

### Key Capabilities

- **Multi-Factor Site Analysis**: 7-factor scoring system with customizable weights
- **Real-Time Data Integration**: Live APIs for elevation, population, and infrastructure data
- **Advanced Geospatial Processing**: PostGIS-powered spatial analysis engine
- **Interactive Visualization**: React-based mapping interface with Leaflet
- **Comprehensive Reporting**: PDF, CSV, and GeoJSON export capabilities
- **Satellite Optimization**: Kuiper constellation pass prediction and link budget analysis

### Target Use Cases

- Satellite ground station placement
- Telecommunications tower siting
- Renewable energy facility planning
- Emergency services coverage optimization
- Infrastructure gap analysis
- Market expansion planning

---

## System Architecture

### Technology Stack

**Backend:**
- **Database**: PostgreSQL 14+ with PostGIS 3.2+ extension
- **API Server**: Node.js with Express.js framework
- **Spatial Processing**: PostGIS spatial functions and custom algorithms
- **External APIs**: ELVIS elevation, ABS population data, NBN infrastructure

**Frontend:**
- **Framework**: React 18+ with TypeScript
- **Mapping**: Leaflet with React-Leaflet integration
- **UI Components**: Material-UI (MUI) v5
- **State Management**: React hooks and context

**Data Storage:**
- **Spatial Data**: PostGIS geometry and raster types
- **Tabular Data**: PostgreSQL relational tables
- **File Storage**: Local filesystem for uploaded datasets

### Database Schema

```sql
-- Mobile infrastructure sites
CREATE TABLE mobile_sites (
    id SERIAL PRIMARY KEY,
    carrier VARCHAR(50),
    site_name VARCHAR(255),
    longitude DECIMAL(10, 7),
    latitude DECIMAL(10, 7),
    geom GEOMETRY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NBN coverage areas
CREATE TABLE nbn_coverage (
    id SERIAL PRIMARY KEY,
    coverage_type VARCHAR(50), -- 'Fixed Line' or 'Wireless'
    service_class VARCHAR(100),
    geom GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate ground station sites
CREATE TABLE candidate_sites (
    id SERIAL PRIMARY KEY,
    longitude DECIMAL(10, 7),
    latitude DECIMAL(10, 7),
    total_score DECIMAL(5, 3),
    score_breakdown JSONB,
    reasoning TEXT,
    geom GEOMETRY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Input Datasets

### Primary Data Sources

#### 1. Telecommunications Infrastructure

**Mobile Carrier Sites**
- **Sources**: Telstra, Optus, TPG public site databases
- **Format**: CSV files with lat/lng coordinates
- **Coverage**: National coverage across Australia
- **Fields**: Carrier, site name, coordinates, operational status
- **Update Frequency**: Monthly from carrier public disclosures

**NBN Coverage Areas**
- **Source**: NBN Co public coverage maps
- **Format**: Shapefile polygons (.shp)
- **Types**: Fixed Line and Wireless coverage footprints
- **Accuracy**: Service area boundaries with technology classification
- **Update Frequency**: Quarterly updates from NBN Co

**Coverage Maps**
- **Source**: Carrier-specific coverage maps (e.g., Optus 4G)
- **Format**: KML files with polygon coverage areas
- **Detail Level**: Technology-specific (3G, 4G, 5G) coverage boundaries
- **Use Case**: RF interference analysis and service overlap assessment

#### 2. Elevation and Terrain Data

**ELVIS Elevation Service**
- **Source**: Australian Government's ELVIS API (https://elevation.fsdf.org.au/)
- **Resolution**: 25-meter DEM (Digital Elevation Model)
- **Coverage**: Complete Australian continent
- **API Type**: REST and WMS endpoints
- **Accuracy**: ±2 meters vertical accuracy
- **Data Type**: Smoothed elevation surface optimized for analysis

**Terrain Analysis**
- **Slope Calculations**: Derived from elevation data
- **Line-of-Sight**: RF propagation modeling
- **Obstruction Analysis**: Terrain masking for satellite visibility

#### 3. Population and Demographics

**ABS Population Data**
- **Source**: Australian Bureau of Statistics
- **Resolution**: Statistical Area Level 1 (SA1) boundaries
- **Metrics**: Population density, urbanization indices
- **Coverage**: Census-based demographic distribution
- **Update Frequency**: Annual estimates with 5-year census updates

**Regional Centers Database**
- **Coverage**: 50+ major urban and regional centers
- **Metrics**: Population density per km², service radius
- **Categories**: Capital cities, regional centers, mining towns
- **Business Intelligence**: Market demand estimation algorithms

#### 4. Land Use and Regulatory Data

**Crown Land Registry**
- **Source**: State government land databases
- **Types**: Available government land, restricted areas
- **Regulatory Status**: Zoning, environmental constraints
- **Availability**: Land use permissions and development restrictions

### Data Ingestion Process

#### Automated Ingestion Pipeline

```python
# Data ingestion workflow (scripts/data_ingestion.py)
1. CSV Processing: Mobile carrier site data → PostgreSQL tables
2. Shapefile Import: NBN coverage → PostGIS spatial tables  
3. KML Parsing: Coverage maps → PostGIS geometry
4. Validation: Data integrity and coordinate system verification
5. Indexing: Spatial and attribute index creation for performance
```

#### Data Quality Assurance

- **Coordinate Validation**: WGS84 datum verification
- **Spatial Indexing**: R-tree indexing for fast spatial queries
- **Duplicate Detection**: Site deduplication across carriers
- **Boundary Validation**: Coverage polygon topology checking

---

## Analysis Methodology

### 7-Factor Scoring System

TerraLink employs a weighted multi-factor analysis approach where each candidate site receives scores across seven key factors:

#### 1. Backhaul Proximity (20% weight)
**Objective**: Minimize distance to existing telecommunications infrastructure
- **Data Sources**: Mobile sites, NBN POPs, fiber networks
- **Calculation**: Distance-weighted scoring with exponential decay
- **Range**: 0-50km optimal, >50km heavily penalized
- **Formula**: `score = max(0, 1 - (distance_km / 50))`

#### 2. Population Proximity (15% weight)
**Objective**: Maximize market potential and service demand
- **Data Sources**: ABS population density, urban centers
- **Calculation**: Weighted sum of population within service radius
- **Range**: 10km primary service area, 25km secondary
- **Formula**: `score = Σ(population_density × distance_weight)`

#### 3. Elevation Advantage (15% weight)
**Objective**: Optimize terrain for RF propagation and satellite visibility
- **Data Sources**: ELVIS 25m DEM
- **Optimal Range**: 200-800m elevation
- **Penalties**: <50m (flooding risk), >1200m (weather/access issues)
- **Calculation**: Gaussian distribution with peak at 400m elevation

#### 4. RF Interference (15% weight)
**Objective**: Minimize electromagnetic interference from existing transmitters
- **Data Sources**: Mobile tower locations, broadcast transmitters
- **Interference Zones**: 
  - High (0-2km): Score 0.2
  - Medium (2-5km): Score 0.6
  - Low (5-10km): Score 0.8
  - Minimal (>10km): Score 1.0

#### 5. Land Availability (15% weight)
**Objective**: Ensure site accessibility and regulatory compliance
- **Data Sources**: Crown land registry, zoning data
- **Categories**:
  - Government/Crown land: Score 1.0
  - Industrial zoning: Score 0.8
  - Rural/agricultural: Score 0.6
  - Urban/residential: Score 0.3
  - Protected/restricted: Score 0.0

#### 6. Satellite Optimization (10% weight)
**Objective**: Maximize satellite visibility and link quality (Kuiper-specific)
- **Analysis**: Daily pass frequency, elevation angles, link budget
- **Kuiper Shells**: 590km, 630km, 610km orbital analysis
- **Metrics**: Pass frequency, maximum elevation, coverage efficiency
- **Weather Factor**: 0.85 multiplier for Australian conditions

#### 7. Market Demand (10% weight)
**Objective**: Quantify business case and revenue potential
- **Calculation**: Population-weighted demand within coverage area
- **Factors**: Urban density, economic activity, competition analysis
- **Coverage Model**: 50km service radius with distance decay

### Scoring Normalization

All factor scores are normalized to 0-1 range before weighted aggregation:

```javascript
total_score = Σ(factor_score × factor_weight)
where Σ(factor_weights) = 1.0
```

### Site Filtering and Ranking

1. **Geographic Bounds**: Restrict analysis to specified bounding box
2. **Minimum Score Threshold**: Filter sites below configurable threshold (default: 0.4)
3. **Spatial Clustering**: Remove sites within 5km of higher-scoring candidates
4. **Ranking**: Sort by total score (descending)
5. **Result Limiting**: Return top N sites (configurable, default: 50)

---

## Calculation Algorithms

### Spatial Distance Calculations

#### Haversine Distance Formula
```javascript
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
```

#### PostGIS Spatial Queries
```sql
-- Find nearest infrastructure sites
SELECT site_name, ST_Distance(ST_GeomFromText('POINT(lng lat)', 4326), geom) as distance
FROM mobile_sites 
ORDER BY geom <-> ST_GeomFromText('POINT(lng lat)', 4326)
LIMIT 10;

-- Population within service radius
SELECT SUM(population_density * area) as total_population
FROM population_grid
WHERE ST_DWithin(
    ST_GeomFromText('POINT(lng lat)', 4326),
    geom,
    50000  -- 50km radius
);
```

### Elevation Analysis Algorithms

#### Point Elevation Retrieval
```javascript
// ELVIS API integration
async function getPointElevation(longitude, latitude) {
    const response = await axios.get(`${ELVIS_REST_URL}/identify`, {
        params: {
            f: 'json',
            geometry: `${longitude},${latitude}`,
            geometryType: 'esriGeometryPoint',
            inSR: '4326',
            returnZ: 'true'
        }
    });
    return response.data.results[0].attributes['Pixel Value'];
}
```

#### Slope Calculation
```javascript
function calculateSlope(point1_elevation, point2_elevation, distance) {
    const elevation_diff = Math.abs(point2_elevation - point1_elevation);
    const slope_radians = Math.atan(elevation_diff / distance);
    return slope_radians * (180 / Math.PI); // Convert to degrees
}
```

### Satellite Pass Optimization

#### Kuiper Constellation Model
```javascript
const KUIPER_CONSTELLATION = {
    shells: [
        { altitude_km: 590, inclination: 51.9, satellites: 1156 },
        { altitude_km: 630, inclination: 51.9, satellites: 1296 },
        { altitude_km: 610, inclination: 53.2, satellites: 1764 }
    ]
};
```

#### Visibility Calculations
```javascript
function calculateSatelliteElevation(groundLat, groundLon, satLat, satLon, satAlt) {
    const distance = calculateDistance(groundLat, groundLon, satLat, satLon);
    const earthRadius = 6371000; // meters
    const satelliteHeight = satAlt * 1000; // convert km to meters
    
    const elevation = Math.atan(
        (satelliteHeight - distance * Math.sin(Math.acos(earthRadius / (earthRadius + satelliteHeight)))) /
        (distance * Math.cos(Math.acos(earthRadius / (earthRadius + satelliteHeight))))
    ) * (180 / Math.PI);
    
    return Math.max(0, elevation);
}
```

#### Link Budget Analysis
```javascript
function calculateLinkBudget(elevationAngle, distance, frequency = 20e9) {
    const freeSpaceLoss = 20 * Math.log10(distance) + 20 * Math.log10(frequency) + 20 * Math.log10(4 * Math.PI / 299792458);
    const atmosphericLoss = calculateAtmosphericLoss(elevationAngle);
    const rainFade = calculateRainFade(elevationAngle);
    
    return {
        free_space_loss_db: freeSpaceLoss,
        atmospheric_loss_db: atmosphericLoss,
        rain_fade_db: rainFade,
        total_loss_db: freeSpaceLoss + atmosphericLoss + rainFade
    };
}
```

### Population Density Modeling

#### Distance-Weighted Population Score
```javascript
function calculatePopulationScore(longitude, latitude) {
    let totalScore = 0;
    
    for (const region of POPULATION_REGIONS) {
        const distance = calculateDistance(latitude, longitude, region.center[1], region.center[0]);
        
        if (distance <= region.radius) {
            const distanceWeight = Math.exp(-distance / (region.radius * 0.3));
            const densityScore = Math.min(region.density / 2000, 1.0); // Normalize to max density
            totalScore += densityScore * distanceWeight;
        }
    }
    
    return Math.min(totalScore, 1.0);
}
```

### RF Interference Assessment

#### Interference Zone Modeling
```javascript
function calculateRFInterference(longitude, latitude) {
    const nearbyTransmitters = findNearbyTransmitters(longitude, latitude, 20000); // 20km search
    let interferenceScore = 1.0;
    
    for (const transmitter of nearbyTransmitters) {
        const distance = transmitter.distance;
        let penalty = 0;
        
        if (distance < 2000) penalty = 0.8;
        else if (distance < 5000) penalty = 0.4;
        else if (distance < 10000) penalty = 0.2;
        else penalty = 0.1;
        
        interferenceScore *= (1 - penalty);
    }
    
    return Math.max(interferenceScore, 0.2); // Minimum score of 0.2
}
```

---

## API Reference

### Core Analysis Endpoints

#### Site Analysis
```http
POST /api/analysis/sites
Content-Type: application/json

{
    "bounds": {
        "north": -25.0,
        "south": -35.0,
        "east": 155.0,
        "west": 140.0
    },
    "weights": {
        "backhaul_proximity": 0.20,
        "population_proximity": 0.15,
        "elevation": 0.15,
        "rf_interference": 0.15,
        "land_availability": 0.15,
        "satellite_optimization": 0.10,
        "market_demand": 0.10
    },
    "site_count": 50,
    "min_score": 0.4
}
```

#### Advanced Analysis
```http
POST /api/advanced/comprehensive-analysis
Content-Type: application/json

{
    "longitude": 151.2093,
    "latitude": -33.8688,
    "analysis_type": "full",
    "include_satellite_optimization": true,
    "include_market_analysis": true
}
```

### Response Format

```json
{
    "success": true,
    "data": {
        "sites": [
            {
                "id": 1,
                "longitude": 151.2093,
                "latitude": -33.8688,
                "total_score": 0.847,
                "score_breakdown": {
                    "backhaul_proximity": 0.92,
                    "population_proximity": 0.85,
                    "elevation": 0.78,
                    "rf_interference": 0.88,
                    "land_availability": 0.90,
                    "satellite_optimization": 0.75,
                    "market_demand": 0.82
                },
                "reasoning": "Excellent site with strong backhaul connectivity...",
                "advanced_metrics": {
                    "elevation_meters": 156,
                    "nearest_infrastructure_km": 2.3,
                    "population_within_25km": 125000,
                    "satellite_passes_daily": 67
                }
            }
        ],
        "analysis_metadata": {
            "total_candidates_evaluated": 2847,
            "analysis_time_ms": 1834,
            "weights_used": { /* weights object */ }
        }
    }
}
```

### Export Endpoints

#### PDF Report Generation
```http
POST /api/exports/pdf
Content-Type: application/json

{
    "sites": [/* site objects */],
    "options": {
        "title": "Site Analysis Report",
        "include_maps": true,
        "include_detailed_analysis": true,
        "include_recommendations": true
    }
}
```

#### GeoJSON Export
```http
POST /api/exports/geojson
Content-Type: application/json

{
    "sites": [/* site objects */],
    "include_properties": true,
    "coordinate_system": "WGS84"
}
```

---

## User Interface

### Landing Page
- **Background**: Custom satellite dish imagery
- **Branding**: TerraLink logo and tagline
- **Entry Point**: "Enter Platform" button for app access

### Main Application Interface

#### Analysis Panel
- **7-Factor Weight Controls**: Sliders for customizing analysis priorities
- **Geographic Bounds**: Interactive map-based area selection
- **Advanced Options**: Site count limits, score thresholds
- **Real-time Preview**: Live parameter validation and estimates

#### Interactive Map
- **Base Layers**: OpenStreetMap, satellite imagery
- **Data Layers**: Mobile towers, NBN coverage, candidate sites
- **Site Visualization**: Color-coded markers by score
- **Popup Details**: Quick site metrics on marker click

#### Results Dashboard
- **Site List**: Sortable table with key metrics
- **Detailed View**: Comprehensive site analysis modal
- **Score Visualization**: Radar charts for factor breakdown
- **Filtering**: Score range, geographic, and criteria filters

#### Export Interface
- **Format Selection**: PDF, CSV, GeoJSON options
- **Customization**: Report content and styling options
- **Batch Operations**: Multi-site export capabilities

---

## Installation & Setup

### Prerequisites
- **Node.js**: Version 16+ with npm
- **PostgreSQL**: Version 14+ with PostGIS 3.2+
- **Python**: Version 3.8+ (for data ingestion scripts)

### Database Setup

```bash
# Install PostGIS extension
sudo apt-get install postgresql-14-postgis-3

# Create database and enable PostGIS
createdb sgs
psql -d sgs -c "CREATE EXTENSION postgis;"
psql -d sgs -c "CREATE EXTENSION postgis_topology;"
```

### Backend Installation

```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with database credentials and API keys

# Start development server
npm run dev
```

### Frontend Installation

```bash
cd frontend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with backend API URL

# Start development server
npm start
```

### Data Ingestion

```bash
cd scripts
pip install -r requirements.txt

# Configure data paths in data_ingestion.py
python data_ingestion.py
```

### Production Deployment

#### Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  database:
    image: postgis/postgis:14-3.2
    environment:
      POSTGRES_DB: sgs
      POSTGRES_USER: sgs_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://sgs_user:${DB_PASSWORD}@database:5432/sgs
    depends_on:
      - database
    
  frontend:
    build: ./frontend
    environment:
      REACT_APP_API_URL: http://backend:3001/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## Usage Examples

### Basic Site Analysis

```javascript
// Frontend API call
const analysisParams = {
    bounds: {
        north: -25.0, south: -35.0,
        east: 155.0, west: 140.0
    },
    weights: {
        backhaul_proximity: 0.25,
        population_proximity: 0.20,
        elevation: 0.15,
        rf_interference: 0.15,
        land_availability: 0.15,
        satellite_optimization: 0.05,
        market_demand: 0.05
    },
    site_count: 20,
    min_score: 0.5
};

const results = await api.analyzeSites(analysisParams);
```

### Advanced Single-Site Analysis

```javascript
// Comprehensive analysis for specific location
const siteAnalysis = await api.getComprehensiveAnalysis({
    longitude: 151.2093,
    latitude: -33.8688,
    include_satellite_optimization: true,
    include_market_analysis: true,
    include_terrain_analysis: true
});
```

### Batch Export

```javascript
// Export top 10 sites to PDF
const exportResult = await api.exportToPDF({
    sites: results.sites.slice(0, 10),
    options: {
        title: 'Sydney Region Ground Station Analysis',
        include_maps: true,
        include_detailed_analysis: true
    }
});
```

---

## Advanced Features

### Satellite Pass Optimization

**Kuiper Constellation Modeling**
- 3-shell orbital configuration with 4,216 total satellites
- Real-time pass prediction and visibility windows
- Link budget calculations including atmospheric effects
- Weather impact modeling for Australian conditions

**Analysis Outputs**
- Daily pass frequency and duration
- Maximum elevation angles
- Coverage efficiency metrics
- RF link quality assessments

### Market Demand Analysis

**Population-Based Modeling**
- ABS demographic integration
- Distance-weighted demand calculation
- Urban vs. rural service differentiation
- Competition analysis and market gaps

**Business Intelligence**
- Revenue potential estimation
- Service area population counts
- Market penetration opportunities
- ROI projections

### Crown Land Integration

**Regulatory Analysis**
- Government land availability assessment
- Zoning and planning compliance
- Environmental constraint evaluation
- Permitting complexity scoring

### Performance Optimizations

**Spatial Indexing**
- R-tree indexing for geometric queries
- Clustered indexing on coordinate columns
- Query plan optimization for large datasets

**Caching Strategies**
- Elevation data caching for frequently analyzed areas
- Population density pre-calculation
- Infrastructure proximity lookup tables

**Parallel Processing**
- Multi-threaded site analysis
- Asynchronous API calls to external services
- Batch processing for large area analysis

### Export and Reporting

**PDF Report Generation**
- Custom branded reports with maps and charts
- Executive summary with key recommendations
- Technical appendix with detailed calculations
- Site comparison matrices

**GIS Integration**
- GeoJSON export for GIS software import
- Shapefile generation with attribute tables
- KML output for Google Earth visualization
- Coordinate system transformations

---

## Conclusion

TerraLink represents a comprehensive solution for location intelligence and site optimization challenges. Its modular architecture, extensive data integration capabilities, and sophisticated analysis algorithms make it suitable for a wide range of infrastructure planning applications beyond its original satellite ground station use case.

The platform's strength lies in its ability to combine multiple data sources and analysis factors into a coherent, weighted scoring system that provides both quantitative results and qualitative reasoning for decision-making. The interactive user interface and flexible export capabilities ensure that results can be effectively communicated to stakeholders across technical and business functions.

For technical support, feature requests, or customization inquiries, please refer to the project repository or contact the development team.

---

*Documentation Version: 1.0*  
*Last Updated: December 2024*  
*Platform Version: TerraLink v1.0*
