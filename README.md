# TerraLink - Advanced Location Intelligence & Analysis Platform

<div align="center">
  <img src="sgs_logo.png" alt="TerraLink Logo" width="120" height="120" style="border-radius: 10px;">
  
  <p><strong>Optimize site placement with cutting-edge geospatial analysis, infrastructure intelligence, and real-time data visualization.</strong></p>
  
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://postgresql.org/)
  [![PostGIS](https://img.shields.io/badge/PostGIS-3.2+-green.svg)](https://postgis.net/)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
</div>

---

## 🚀 **Overview**

TerraLink is a sophisticated geospatial analysis platform designed for optimal site placement decisions using multi-factor intelligence. Originally developed for Amazon Kuiper satellite ground station optimization, the platform provides comprehensive location analysis capabilities for telecommunications infrastructure, renewable energy sites, and strategic facility planning.

### ✨ **Key Features**

- **🎯 Multi-Factor Site Analysis**: 7-factor scoring system with customizable weights
- **🌍 Real-Time Data Integration**: Live APIs for elevation, population, and infrastructure data
- **🗺️ Interactive Visualization**: React-based mapping interface with Leaflet
- **📊 Advanced Analytics**: Satellite optimization, RF interference analysis, market demand modeling
- **📄 Comprehensive Reporting**: PDF, CSV, and GeoJSON export capabilities
- **⚡ High Performance**: PostGIS-powered spatial analysis engine with caching

---

## 🏗️ **Architecture**

### **Technology Stack**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18+ with TypeScript | Interactive user interface |
| **Backend** | Node.js with Express.js | RESTful API server |
| **Database** | PostgreSQL 14+ with PostGIS 3.2+ | Spatial data storage and analysis |
| **Mapping** | Leaflet with React-Leaflet | Interactive geospatial visualization |
| **UI Framework** | Material-UI (MUI) v5 | Modern component library |

### **Data Sources**

- **📡 Telecommunications**: Mobile carrier sites (Telstra, Optus, TPG), NBN coverage
- **🏔️ Elevation**: Australian ELVIS API (25m resolution DEM)
- **👥 Population**: Australian Bureau of Statistics demographic data
- **🏛️ Regulatory**: Crown land registry and zoning information
- **🛰️ Satellite**: Kuiper constellation orbital mechanics and link budgets

---

## 📋 **Analysis Methodology**

TerraLink employs a **7-factor weighted scoring system** for optimal site selection:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Backhaul Proximity** | 20% | Distance to existing telecommunications infrastructure |
| **Population Proximity** | 15% | Market potential and service demand |
| **Elevation Advantage** | 15% | Terrain optimization for RF propagation |
| **RF Interference** | 15% | Electromagnetic interference assessment |
| **Land Availability** | 15% | Regulatory compliance and site accessibility |
| **Satellite Optimization** | 10% | Kuiper constellation visibility and link quality |
| **Market Demand** | 10% | Business case and revenue potential |

### **Sample Analysis Results**

```json
{
  "site": {
    "latitude": -33.8688,
    "longitude": 151.2093,
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
    "reasoning": "Excellent site with strong backhaul connectivity and high population density..."
  }
}
```

---

## 🚀 **Quick Start**

### **Prerequisites**

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ with PostGIS extension ([Installation Guide](https://postgis.net/install/))
- **Python** 3.8+ (for data ingestion scripts)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/minesh16/satellite-ground-station-tool.git
   cd satellite-ground-station-tool
   ```

2. **Database Setup**
   ```bash
   # Create database and enable PostGIS
   createdb sgs
   psql -d sgs -c "CREATE EXTENSION postgis;"
   psql -d sgs -c "CREATE EXTENSION postgis_topology;"
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your database credentials
   
   # Start development server
   npm run dev
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with backend API URL
   
   # Start development server
   npm start
   ```

5. **Data Ingestion** (Optional)
   ```bash
   cd scripts
   pip install -r requirements.txt
   python data_ingestion.py
   ```

### **Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health

---

## 📖 **Usage Examples**

### **Basic Site Analysis**

```javascript
// Analyze sites within a geographic area
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

const results = await fetch('/api/analysis/sites', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(analysisParams)
});
```

### **Advanced Single-Site Analysis**

```javascript
// Comprehensive analysis for specific location
const siteAnalysis = await fetch('/api/advanced/comprehensive-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    longitude: 151.2093,
    latitude: -33.8688,
    include_satellite_optimization: true,
    include_market_analysis: true
  })
});
```

---

## 🎯 **Key Features**

### **Interactive Analysis Panel**
- Customizable factor weights with real-time sliders
- Geographic bounds selection via interactive map
- Advanced filtering and site count controls

### **Comprehensive Results Dashboard**
- Sortable site rankings with detailed metrics
- Interactive radar charts for factor visualization
- Detailed site analysis with reasoning explanations

### **Advanced Reporting**
- **PDF Reports**: Executive summaries with maps and recommendations
- **GeoJSON Export**: Compatible with GIS software (QGIS, ArcGIS)
- **CSV Export**: Tabular data for spreadsheet analysis

### **Real-Time Data Integration**
- **ELVIS Elevation API**: 25m resolution Australian terrain data
- **ABS Demographics**: Population density and market analysis
- **NBN Infrastructure**: Coverage areas and backhaul connectivity

---

## 🛰️ **Satellite Optimization**

TerraLink includes advanced satellite analysis specifically designed for the **Amazon Kuiper constellation**:

### **Kuiper Constellation Model**
- **3 Orbital Shells**: 590km, 630km, 610km altitudes
- **4,216 Total Satellites** across all shells
- **Daily Pass Analysis**: Frequency, duration, and elevation angles
- **Link Budget Calculations**: RF propagation with atmospheric effects

### **Analysis Outputs**
- Maximum elevation angles and visibility windows
- Daily pass frequency and coverage efficiency
- Link quality assessment with weather factors
- Terrain obstruction analysis

---

## 📊 **Database Schema**

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
    coverage_type VARCHAR(50),
    service_class VARCHAR(100),
    geom GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate analysis results
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

## 🔌 **API Reference**

### **Core Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analysis/sites` | Multi-site analysis with custom parameters |
| `POST` | `/api/advanced/comprehensive-analysis` | Detailed single-site analysis |
| `GET` | `/api/infrastructure/mobile` | Mobile tower locations |
| `GET` | `/api/infrastructure/nbn` | NBN coverage data |
| `POST` | `/api/exports/pdf` | Generate PDF reports |
| `POST` | `/api/exports/geojson` | Export spatial data |

### **Response Format**

```json
{
  "success": true,
  "data": {
    "sites": [...],
    "analysis_metadata": {
      "total_candidates_evaluated": 2847,
      "analysis_time_ms": 1834,
      "weights_used": {...}
    }
  }
}
```

---

## 🚢 **Deployment**

### **Docker Deployment**

```yaml
version: '3.8'
services:
  database:
    image: postgis/postgis:14-3.2
    environment:
      POSTGRES_DB: sgs
      POSTGRES_USER: sgs_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://sgs_user:${DB_PASSWORD}@database:5432/sgs
    depends_on:
      - database
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

### **Environment Variables**

**Backend (.env):**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgs
DB_USER=postgres
DB_PASSWORD=your_secure_password
NODE_ENV=production
```

**Frontend (.env):**
```bash
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_MAP_CENTER_LAT=-25.2744
REACT_APP_MAP_CENTER_LNG=133.7751
REACT_APP_MAP_DEFAULT_ZOOM=6
```

---

## 📁 **Project Structure**

```
satellite-ground-station-tool/
├── 📁 backend/                    # Node.js API server
│   ├── 📁 routes/                 # API endpoint definitions
│   ├── 📁 services/               # Business logic and external APIs
│   ├── 📁 utils/                  # Database and utility functions
│   └── 📁 middleware/             # Express middleware
├── 📁 frontend/                   # React application
│   ├── 📁 src/components/         # React components
│   ├── 📁 src/services/           # API client functions
│   └── 📁 src/types/              # TypeScript type definitions
├── 📁 scripts/                    # Data ingestion and utilities
├── 📁 database/                   # Database schemas and migrations
├── 📄 TerraLink_Documentation.md  # Comprehensive user guide
├── 📄 Technical_Reference.md      # Detailed technical specifications
└── 📄 README.md                   # This file
```

---

## 🤝 **Contributing**

We welcome contributions to TerraLink! Here's how you can help:

### **Development Setup**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### **Contribution Guidelines**

- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation for API changes
- Ensure all tests pass before submitting

---

## 📚 **Documentation**

- **[User Guide](TerraLink_Documentation.md)** - Complete system overview and usage guide
- **[Technical Reference](Technical_Reference.md)** - Detailed algorithm specifications and implementation
- **[API Documentation](TerraLink_Documentation.md#api-reference)** - Complete API reference with examples

---

## 📈 **Performance**

TerraLink is optimized for large-scale analysis:

- **Spatial Indexing**: R-tree indexes for fast geometric queries
- **Parallel Processing**: Multi-threaded site analysis
- **Intelligent Caching**: Elevation and population data caching
- **Query Optimization**: Optimized PostGIS spatial queries

**Typical Performance:**
- **Site Analysis**: ~500 sites/second on modern hardware
- **Database Queries**: <100ms for most spatial operations
- **API Response**: <2 seconds for 50-site analysis

---

## 🐛 **Known Issues & Roadmap**

### **Current Limitations**
- Analysis limited to Australian geographic bounds
- ELVIS API rate limiting may slow large area analysis
- Satellite optimization specific to Kuiper constellation

### **Upcoming Features**
- [ ] Global elevation data support
- [ ] Additional satellite constellation models
- [ ] Real-time weather integration
- [ ] Machine learning-based site scoring
- [ ] Advanced terrain analysis with viewshed calculations

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Australian Government ELVIS** for elevation data API access
- **Australian Bureau of Statistics** for demographic data
- **NBN Co** for infrastructure coverage data
- **PostGIS Community** for spatial database capabilities
- **React and Node.js Communities** for excellent development frameworks

---

## 📞 **Support**

- **Documentation**: [TerraLink User Guide](TerraLink_Documentation.md)
- **Issues**: [GitHub Issues](https://github.com/minesh16/satellite-ground-station-tool/issues)
- **Discussions**: [GitHub Discussions](https://github.com/minesh16/satellite-ground-station-tool/discussions)

---

<div align="center">
  <p><strong>Built with ❤️ for advanced geospatial analysis</strong></p>
  <p>TerraLink - Connecting locations with intelligence</p>
</div>
