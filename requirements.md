# Requirements Document: Satellite Ground Station Location Optimization Tool for Amazon Kuiper

## Overview

This web application will ingest and analyze geospatial, telecommunications, and demographic datasets to recommend the best locations in Australia for Amazon Kuiper to install satellite ground stations. It provides both geospatial visualization and detailed reasoning for each proposed site, supporting strategic planning and technical decision-making.

**Tech Stack:**
- Backend Database: PostgreSQL with PostGIS extension for spatial data
- API Layer: Node.js (Express), Django REST Framework, or PostgREST
- Front End: React + React-Leaflet for interactive mapping
- Integration: Ability to ingest GIS formats (GeoJSON, raster DEMs, shapefiles), telecom infrastructure, population datasets

***

## Functional Requirements

### 1. Data Ingestion and Storage

**Datasets Supported:**
- Digital Elevation Models (ELVIS, SRTM, Copernicus, state-level LiDAR)[1][2][3]
- Telecommunications infrastructure:
    - NBN POIs, backhaul, wireless/fiber coverage[4][5][6]
    - Mobile carrier base station sites (Telstra, Optus, TPG), backhaul fiber, microwave, satellite gateway assets[7][8]
- Population and demographic grids
    - ABS population density, urbanization, industry zones
- Land use and property boundaries
    - Crown land registry, government site availability

**Storage:**
- PostgreSQL tables for non-spatial attributes
- PostGIS spatial types (`geometry`, `raster`) for geospatial entities
    - Indexed for high-performance spatial querying[9][10][11][12][13]

**APIs:**
- RESTful endpoints for CRUD operations and bulk dataset upload
    - GeoJSON, CSV, raster file ingestion[14][15]

### 2. Geospatial Analysis Logic

**Spatial Queries:**
- Elevation and slope calculation using DEMs
- Proximity analysis to fiber backhaul, mobile towers, urban areas, and transport routes
- Buffering, intersection, and exclusion of RF-sensitive or regulated zones

**Optimization Algorithms:**
- Multi-factor scoring system
    - Satellite pass benefits: elevation angle, frequency, orbital shell coverage
    - RF environment and terrain obstruction assessment
    - Proximity to infrastructure for backhaul integration
    - Market demand (population density, industry clusters)
    - Land suitability and regulatory exclusion zones
- Ability to weight factors for scenario modeling

**Reasoning Module:**
- For each recommended site, generate a breakdown of contributing factors
    - E.g., "Site X is elevated (350m), 5km from NBN POI, and 25km from nearest city, minimizing RF interference while maximizing backhaul access."

### 3. Front-End Visualization

**Map-based UI:**
- Interactive map using React-Leaflet[16][17][18][19][20]
    - Layer controls for terrain, infrastructure, covered regions, proposed sites
    - Satellite imagery and street map base layers[21]
- Search and filter tools (e.g., region, infrastructure type, score thresholds)
- Map markers for candidate ground station locations
    - Pop-ups or panels with detailed reasoning and scoring breakdown

**Data Exploration:**
- Display of underlying datasets via map overlays (DEM, population grids, infrastructure)
- Site comparison dashboard with sortable tables

**Reporting:**
- Downloadable site recommendations including map images and supporting data

### 4. User Interaction and Customization

- Parameter weighting and scenario editing (user sets importance of elevation, proximity, population, etc.)
- Ability to upload custom geospatial datasets
- Query-by-region or AOI selection for focused analysis

***

## Non-Functional Requirements

### 1. Scalability
- Efficient spatial queries even for large raster and vector datasets
- Caching for repeated analyses and map tile serving

### 2. Security
- Role-based authentication (admin uploads, analysts configure scenarios)
- Input validation and data integrity for GIS files

### 3. Usability
- Intuitive modern interface using React best practices and responsive layout
- Detailed documentation and onboarding for dataset format, use cases

### 4. Extensibility
- Modular API endpoints and analysis logic for future factors (e.g., renewable energy availability, disaster risk)

### 5. Integration and Open Data
- Ability to connect to live APIs (e.g., NBN, ABS, ELVIS via REST or WMS[22][23])
- Export functions: GeoJSON, CSV, PDF of reports

***

## Example Architecture

**Backend:**
- PostgreSQL + PostGIS[10][12][13][11]
- API Layer (Node.js/Express, Python/Django REST, or PostgREST for instant RESTful access)[14][24][25]
- Ingestion Scripts for raster/vector datasets

**Frontend:**
- React + React-Leaflet[16][21][20][17][18]
- Interactive analysis controls for custom scenario building

***

## Dataset Sources (Recommended)

- Elevation: ELVIS (https://elevation.fsdf.org.au)[3][2][22][26]
- NBN coverage: Communications/NBN_Coverage (MapServer)[4][5][6][8]
- Mobile Tower Locations: ACCC Mobile Infrastructure Report[7]
- Population: ABS data cubes and grids
- Land Use: State Crown land registries and government property APIs

***

## Suggested Development Workflow

1. Configure PostgreSQL with PostGIS and ingest representative datasets
2. Develop API endpoints for spatial analysis logic
3. Prototype React Leaflet frontend, enabling dynamic display of analysis results
4. Implement scoring and reasoning engine to justify proposed sites
5. Integrate uploading/parameter configuration
6. Test usability with real regional scenarios
7. Deploy with security and data privacy controls

***

## References

Open data portals, technical documentation for PostGIS, React Leaflet, NBN coverage APIs, and Australian GIS repositories cited throughout document.

***

This requirements document will guide the development of an advanced, explainable, and scalable tool for optimizing Kuiper ground station placements in Australia by harnessing geospatial intelligence and multi-factor scenario modeling.

Sources
[1] The 5 Best Free Sources of Elevation Data in Australia https://geopera.com/blog/free-sources-of-dem-data
[2] Digital Elevation Data https://www.ga.gov.au/scientific-topics/national-location-information/digital-elevation-data
[3] ELVIS Elevation Data - Digital Atlas of Australia https://elevation.fsdf.org.au
[4] Communications/NBN_Coverage (MapServer) https://spatial.infrastructure.gov.au/server/rest/services/Communications/NBN_Coverage/MapServer
[5] National Broadband Network https://researchdata.edu.au/national-broadband-network/3525561
[6] Distribution: NBN - Broadband Service Footprints (March 2024) https://dev.magda.io/dataset/ds-dga-9005c4ad-fc82-4f3f-a54e-bc6c62bbc45e/distribution/dist-dga-68741acf-026a-477f-958d-7b8bed8e5f55
[7] Mobile Infrastructure Report https://www.accc.gov.au/by-industry/telecommunications-and-internet/mobile-services-regulation/mobile-infrastructure-report
[8] NBN Co and Telstra USO Service Data Map - Overview https://spatial.infrastructure.gov.au/portal/home/item.html?id=6ee60aaafdd64f20909a3ba5a57804a5
[9] Getting started with Spatial Data in PostgreSQL https://www.sqlshack.com/getting-started-with-spatial-data-in-postgresql/
[10] PostGIS https://postgis.net
[11] Applications of PostGIS and PostgreSQL in Modern ... https://www.ve3.global/applications-of-postgis-and-postgresql-in-modern-geospatial-analysis/
[12] Chapter 4. Data Management https://postgis.net/docs/using_postgis_dbmanagement.html
[13] PostgreSQL - An Open Source Geospatial Database For ... https://mapscaping.com/podcast/postgresql-an-open-source-geospatial-database-for-gis-practitioners/
[14] Rest API with PostgreSQL and Node Js, Step-by- ... https://dev.to/alakkadshaw/rest-api-with-postgresql-and-node-js-step-by-step-tutorial-2d2k
[15] Which middleware to use for Postgres/PostGIS <-> https://www.reddit.com/r/gis/comments/e29ulo/which_middleware_to_use_for_postgrespostgis/
[16] How to Build and Deploy a Web Mapping App with React ... https://www.youtube.com/watch?v=cLI29wKukdo
[17] React Leaflet: React components for Leaflet maps https://react-leaflet.js.org
[18] Map creation and interactions https://react-leaflet.js.org/docs/api-map/
[19] React Leaflet Tutorial for Beginners (2025) https://www.youtube.com/watch?v=jD6813wGdBA
[20] Quickstart: React Leaflet https://docs.stadiamaps.com/tutorials/getting-started-with-react-leaflet/
[21] react leaflet -layer control -satellite view https://stackoverflow.com/questions/69558520/react-leaflet-layer-control-satellite-view
[22] Ground Surface Elevation | Digital Atlas of Australia https://digital.atlas.gov.au/maps/digitalatlas::ground-surface-elevation/about?layer=0
[23] Telecommunications in New Developments - Dataset https://data.gov.au/data/dataset/telecommunications-in-new-developments
[24] PostgREST: Revolutionizing Web Development with ... https://marmelab.com/blog/2024/11/04/postgrest-revolutionizing-web-development-with-instant-apis.html
[25] Building a Serverless Web Application with AWS Services ... https://roshancloudarchitect.me/building-a-serverless-web-application-with-aws-services-react-and-postgresql-795e349b33d1
[26] Seamless composite high resolution Digital Elevation ... https://data.csiro.au/collection/csiro:64134
[27] Australian Telecoms Infrastructure Intelligence - Market Clarity https://marketclarity.com.au/products/the-australian-telecoms-infrastructure-business-intelligence/
[28] Digital Elevation Model - NSW Data https://data.nsw.gov.au/data/dataset/?tags=Digital+Elevation+Model
[29] A Synergy in Spatial Analysis https://wherobots.com/blog/wherobots-postgresql-postgis-better-together/
[30] Elevation, DEM and LiDAR - Geospatial (GIS), Maps & Aerial ... https://unimelb.libguides.com/c.php?g=402981&p=7076453
[31] Building a Full Stack Web App with React JS, Python & ... https://www.youtube.com/watch?v=ZbWG9okkrCo
[32] ENVI Remote Sensing Software for Image Processing & ... https://www.nv5geospatialsoftware.com/Products/ENVI
[33] Getting started with Postgres in your React app https://blog.logrocket.com/getting-started-postgres-react-app/
[34] Best Terrain Analysis Tools for Mapping and Exploration https://flypix.ai/blog/terrain-analysis-tools/
[35] React, Node.js, Express and PostgreSQL CRUD app https://www.corbado.com/blog/react-express-crud-app-postgresql
[36] Free Satellite Imagery Sources: Zoom In Our Planet https://eos.com/blog/free-satellite-imagery-sources/
[37] Terrain Elevation | NASA Earthdata https://www.earthdata.nasa.gov/topics/land-surface/terrain-elevation
[38] Build an Interactive Map with React Leaflet and Strapi https://strapi.io/blog/how-to-build-an-interactive-map-with-react-leaflet-and-strapi
[39] Top GIS Software | Global Mapper https://www.bluemarblegeo.com/global-mapper/
