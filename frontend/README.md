# TerraLink - Frontend

React-based frontend application for the TerraLink Location Intelligence Platform.

## Features

- **Interactive Map**: Leaflet-based mapping with multiple base layers (OpenStreetMap, Satellite)
- **Layer Controls**: Toggle visibility of mobile towers, NBN coverage, and candidate sites
- **Analysis Interface**: Parameter adjustment sliders for weighting different factors
- **Results Dashboard**: Sortable and filterable list of candidate sites with detailed scoring
- **Responsive Design**: Material-UI components optimized for desktop and mobile devices

## Technology Stack

- **React 19** with TypeScript
- **Material-UI (MUI)** for modern, responsive components
- **React-Leaflet** for interactive mapping
- **Axios** for API communication

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend API running on port 3001

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables (create .env file):
   ```
   REACT_APP_API_URL=http://localhost:3001/api
   REACT_APP_MAP_CENTER_LAT=-25.2744
   REACT_APP_MAP_CENTER_LNG=133.7751
   REACT_APP_MAP_DEFAULT_ZOOM=6
   ```

3. Start development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
```

## Component Architecture

- **App.tsx**: Main application layout with drawer navigation
- **MapComponent.tsx**: Interactive map with site markers and layer controls
- **AnalysisPanel.tsx**: Parameter controls and analysis configuration
- **ResultsDashboard.tsx**: Site results with sorting, filtering, and export
- **services/api.ts**: API service layer for backend communication
- **types/index.ts**: TypeScript interfaces and type definitions

## Usage

1. **Configure Analysis Parameters**: Use the analysis panel to adjust factor weights (must sum to 100%)
2. **Set Search Parameters**: Define maximum sites, search radius, and exclusion zones
3. **Run Analysis**: Click "Generate Candidate Sites" to execute the optimization
4. **Review Results**: View ranked sites in the results dashboard
5. **Explore on Map**: Click sites to view details and select for further analysis
6. **Export Results**: Download candidate sites as CSV for external use

## Map Layers

- **Mobile Towers**: Color-coded by carrier (Telstra=red, Optus=teal, TPG=blue)
- **NBN Coverage**: Fixed line and wireless coverage areas
- **Candidate Sites**: Generated optimization results with scoring

## API Integration

The frontend communicates with the backend API for:
- Loading infrastructure data (mobile sites, NBN coverage)
- Running spatial analysis algorithms
- Retrieving candidate site rankings and reasoning
- Exporting results in various formats