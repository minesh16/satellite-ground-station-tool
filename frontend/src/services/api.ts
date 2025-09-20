import axios from 'axios';
import { Site, AnalysisParameters, AnalysisResult, AdvancedAnalysisResult, ExportOptions } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export const apiService = {
  // Dataset endpoints
  async getDatasets() {
    const response = await api.get('/datasets');
    return response.data;
  },

  async uploadDataset(file: File, type: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await api.post('/datasets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Infrastructure endpoints
  async getMobileSites(filters?: {
    carrier?: string;
    technology?: string;
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  }): Promise<Site[]> {
    try {
      const response = await api.get('/infrastructure/mobile', {
        params: filters,
      });
      
      // Convert backend mobile site data to frontend Site format
      const sites = response.data?.data?.sites || [];
      return sites.map((site: any) => ({
        id: site.site_id,
        name: site.site_name || `${site.carrier} ${site.site_id}`,
        latitude: parseFloat(site.latitude),
        longitude: parseFloat(site.longitude),
        type: 'mobile' as const,
        carrier: site.carrier?.toLowerCase(),
        technology: site.technology,
        score: undefined,
        reasoning: [],
      }));
    } catch (error) {
      console.warn('Failed to fetch mobile sites:', error);
      return [];
    }
  },

  async getNbnCoverage(bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) {
    try {
      const params: any = {};
      if (bounds) {
        params.bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
      }
      
      const response = await api.get('/infrastructure/nbn', { params });
      const rawData = response.data?.data?.coverage_areas || [];
      
      // Filter out items with null geometry and add unique IDs
      const validCoverageAreas = rawData
        .filter((item: any) => item.geometry !== null)
        .map((item: any, index: number) => ({
          id: `nbn-${index}`,
          service_category: item.service_category,
          coverage_type: item.coverage_type,
          technology: item.coverage_type,
          geometry: item.geometry,
        }));
      
      return validCoverageAreas;
    } catch (error) {
      console.warn('Failed to fetch NBN coverage:', error);
      return [];
    }
  },

  async getMobileCoverage(filters?: {
    carrier?: string;
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  }) {
    try {
      const params: any = { include_coverage: 'true' };
      if (filters?.carrier) {
        params.carrier = filters.carrier;
      }
      if (filters?.bounds) {
        params.bbox = `${filters.bounds.west},${filters.bounds.south},${filters.bounds.east},${filters.bounds.north}`;
      }
      
      const response = await api.get('/infrastructure/mobile', { params });
      return Array.isArray(response.data?.data?.coverage_areas) ? response.data.data.coverage_areas : [];
    } catch (error) {
      console.warn('Failed to fetch mobile coverage:', error);
      return [];
    }
  },

  // Analysis endpoints
  async generateCandidateSites(parameters: AnalysisParameters): Promise<AnalysisResult> {
    try {
      // Convert frontend parameters to backend format (now supports 7-factor system)
      const weights = {
        backhaul_proximity: parameters.proximityToBackhaul / 100,
        population_proximity: parameters.populationDensity / 100,
        elevation: parameters.terrainSuitability / 100,
        rf_interference: parameters.regulatoryCompliance / 100,
        land_availability: parameters.costEffectiveness / 100,
        satellite_optimization: (parameters.satelliteOptimization || 0) / 100,
        market_demand: (parameters.marketDemand || 0) / 100,
      };

      // Use dynamic bounding box based on map bounds or default to broader Australia area
      const bbox = parameters.boundingBox || [110.0, -45.0, 160.0, -10.0]; // [minLng, minLat, maxLng, maxLat] for broader Australia

      const backendParams = {
        bbox,
        weights,
        max_sites: parameters.maxSites,
        min_score: 0.1, // Lower threshold to get more results
        grid_resolution: 0.05, // ~5km resolution for faster analysis
        analysis_name: 'Frontend Generated Analysis',
        constraints: {
          exclude_zones: parameters.excludeZones,
          search_radius_km: parameters.searchRadius,
        }
      };

      // Convert to query parameters for GET request
      const queryParams = {
        bbox: bbox.join(','),
        max_sites: parameters.maxSites,
        min_score: 0.1,
        grid_resolution: 0.05,
        weights: JSON.stringify(weights)
      };

      console.log('Sending analysis request:', queryParams);
      
      const response = await api.get('/analysis/sites', { params: queryParams });
      const data = response.data;
      
      // Convert backend response to frontend format  
      const sites = data.analysis?.candidate_sites || [];
      const convertedSites = sites.map((site: any) => ({
        id: site.id,
        name: `Candidate Site ${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`,
        latitude: site.latitude,
        longitude: site.longitude,
        type: 'candidate' as const,
        score: Math.round(site.total_score * 100), // Convert to percentage
        reasoning: site.reasoning ? [site.reasoning] : [],
        population_served: site.score_breakdown?.population_score * 10000 || 0,
        coverage_area: 25, // Default coverage area estimate
      }));

      return {
        sites: convertedSites,
        summary: {
          totalSites: convertedSites.length,
          averageScore: convertedSites.reduce((sum: number, site: any) => sum + (site.score || 0), 0) / convertedSites.length || 0,
          coverage: convertedSites.length * 25, // Estimated coverage
          estimatedCost: convertedSites.length * 500000, // $500k per site estimate
        },
        parameters,
      };
    } catch (error) {
      console.warn('Failed to generate candidate sites:', error);
      throw error; // Re-throw to let the component handle the error display
    }
  },

  async customAnalysis(parameters: AnalysisParameters & { customFactors?: any }) {
    const response = await api.post('/analysis/custom', parameters);
    return response.data;
  },

  async getSiteReasoning(siteId: string) {
    const response = await api.get(`/sites/${siteId}/reasoning`);
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  // ===== PHASE 4 ADVANCED SERVICES =====
  
  // Elevation Services
  async getElevation(longitude: number, latitude: number, areaAnalysis = false) {
    const params = { longitude, latitude, area_analysis: areaAnalysis };
    const response = await api.get('/advanced/elevation', { params });
    return response.data;
  },

  async calculateSlope(startPoint: {longitude: number, latitude: number}, endPoint: {longitude: number, latitude: number}) {
    const response = await api.post('/advanced/elevation/slope', {
      start_point: startPoint,
      end_point: endPoint
    });
    return response.data;
  },

  // Population Services
  async getPopulationAnalysis(longitude: number, latitude: number, radius = 25000) {
    const params = { longitude, latitude, radius };
    const response = await api.get('/advanced/population', { params });
    return response.data;
  },

  // Satellite Optimization Services
  async getSatelliteOptimization(longitude: number, latitude: number, options?: {
    target_elevation_angle?: number;
    analysis_period_hours?: number;
    weather_factor?: number;
  }) {
    const params = { 
      longitude, 
      latitude, 
      ...options 
    };
    const response = await api.get('/advanced/satellite-optimization', { params });
    return response.data;
  },

  async calculateLineOfSight(
    startPoint: {longitude: number, latitude: number}, 
    endPoint: {longitude: number, latitude: number},
    startHeight = 10,
    endHeight = 0
  ) {
    const response = await api.post('/advanced/line-of-sight', {
      start_point: startPoint,
      end_point: endPoint,
      start_height: startHeight,
      end_height: endHeight
    });
    return response.data;
  },

  // Crown Land Services
  async getCrownLandAnalysis(longitude: number, latitude: number) {
    const params = { longitude, latitude };
    const response = await api.get('/advanced/crown-land', { params });
    return response.data;
  },

  // Comprehensive Advanced Analysis
  async getComprehensiveAnalysis(longitude: number, latitude: number, options = {}) {
    const response = await api.post('/advanced/comprehensive-analysis', {
      longitude,
      latitude,
      analysis_options: options
    });
    return response.data;
  },

  // Advanced Capabilities
  async getAdvancedCapabilities() {
    const response = await api.get('/advanced/capabilities');
    return response.data;
  },

  // Export Services
  async exportToPDF(analysisData: any, options: ExportOptions = {}) {
    const response = await api.post('/exports/pdf', {
      analysisData,
      options
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  async exportToGeoJSON(analysisData: any, options: ExportOptions = {}) {
    const response = await api.post('/exports/geojson', {
      analysisData,
      options
    });
    return response.data;
  },

  async exportToCSV(analysisData: any, options: ExportOptions = {}) {
    const response = await api.post('/exports/csv', {
      analysisData,
      options
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  async getExportFormats() {
    const response = await api.get('/exports/formats');
    return response.data;
  },

  // Enhanced site analysis with advanced features
  async getAdvancedSiteAnalysis(siteId: string): Promise<AdvancedAnalysisResult> {
    const response = await api.get(`/sites/${siteId}/advanced`);
    return response.data;
  },

  // Batch advanced analysis
  async runBatchAdvancedAnalysis(sites: Array<{longitude: number, latitude: number}>) {
    const analyses = await Promise.all(
      sites.map(site => this.getComprehensiveAnalysis(site.longitude, site.latitude))
    );
    return analyses;
  },
};

export default apiService;
