export interface Site {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'mobile' | 'nbn' | 'candidate';
  carrier?: 'telstra' | 'optus' | 'tpg';
  technology?: string;
  band?: string;
  coverage_area?: number;
  population_served?: number;
  score?: number;
  reasoning?: string[];
  // Advanced analysis data
  elevation?: number;
  satellite_metrics?: SatelliteMetrics;
  market_analysis?: MarketAnalysis;
  crown_land_info?: CrownLandInfo;
  detailed_scores?: ScoreBreakdown;
}

export interface AnalysisParameters {
  proximityToBackhaul: number;
  populationDensity: number;
  terrainSuitability: number;
  regulatoryCompliance: number;
  costEffectiveness: number;
  maxSites: number;
  searchRadius: number;
  excludeZones: string[];
  // Phase 4 additions
  satelliteOptimization?: number;
  marketDemand?: number;
  useAdvancedAnalysis?: boolean;
  elevationAnalysis?: boolean;
  crownLandAnalysis?: boolean;
  // Map bounds for dynamic analysis area
  boundingBox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface InfrastructureLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'mobile' | 'nbn' | 'candidate' | 'mobile-coverage' | 'nbn-coverage';
  color: string;
  icon?: string;
  fillOpacity?: number;
  strokeWeight?: number;
}

export interface CoverageArea {
  id: string;
  carrier?: string;
  technology?: string;
  service_category?: string;
  coverage_type?: string;
  signal_strength?: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AnalysisResult {
  sites: Site[];
  summary: {
    totalSites: number;
    averageScore: number;
    coverage: number;
    estimatedCost: number;
  };
  parameters: AnalysisParameters;
}

// ===== PHASE 4 ADVANCED TYPES =====

export interface SatelliteMetrics {
  total_daily_passes: number;
  avg_pass_duration_minutes: number;
  max_elevation_angle: number;
  coverage_efficiency: number;
  optimization_score: number;
  link_budget: {
    elevation_gain_db: number;
    terrain_gain_db: number;
    weather_margin_db: number;
  };
}

export interface MarketAnalysis {
  population_density: number;
  estimated_population: number;
  market_characteristics: {
    is_urban: boolean;
    is_metropolitan: boolean;
    is_remote: boolean;
  };
  demand_factors: {
    internet_demand: number;
    business_demand: number;
    infrastructure_gap: number;
  };
  overall_demand_score: number;
}

export interface CrownLandInfo {
  land_availability_score: number;
  state_territory: string;
  land_use: {
    category: string;
    score: number;
    description: string;
  };
  regulatory_analysis: {
    exclusions: Array<{
      type: string;
      restriction_level: string;
      description: string;
    }>;
    overall_restriction_level: string;
    is_site_restricted: boolean;
    clearance_required: boolean;
  };
  recommendations: string[];
  next_steps: string[];
}

export interface ScoreBreakdown {
  backhaul_proximity: number;
  population_proximity: number;
  elevation: number;
  rf_interference: number;
  land_availability: number;
  satellite_optimization?: number;
  market_demand?: number;
}

export interface ElevationData {
  elevation_meters: number;
  data_source: string;
  analysis_type: string;
  location: {
    longitude: number;
    latitude: number;
  };
}

export interface LineOfSightAnalysis {
  line_of_sight_clear: boolean;
  distance_km: number;
  elevation_difference: number;
  min_clearance_meters: number;
  obstructions: Array<{
    latitude: number;
    longitude: number;
    elevation: number;
    obstruction_height: number;
  }>;
  fresnel_zone_clearance: string;
}

export interface AdvancedAnalysisResult {
  location: {
    longitude: number;
    latitude: number;
  };
  advanced_analysis: {
    elevation_analysis: ElevationData;
    market_analysis: MarketAnalysis;
    satellite_optimization: {
      optimization_score: number;
      pass_metrics: SatelliteMetrics;
      terrain_analysis: any;
      recommendations: string[];
    };
    crown_land_analysis: CrownLandInfo;
    overall_advanced_score: number;
  };
}

export interface ExportOptions {
  title?: string;
  includeDetailedAnalysis?: boolean;
  includeRecommendations?: boolean;
  includeMaps?: boolean;
  includeAllData?: boolean;
  maxFeatures?: number;
  maxRecords?: number;
  minScore?: number;
  includeDetailedScores?: boolean;
  includeCoordinates?: boolean;
}

export interface ExportFormat {
  description: string;
  content_type: string;
  options: Record<string, string>;
}

export interface AdvancedCapabilities {
  elevation_services: {
    point_elevation: string;
    elevation_grid: string;
    slope_calculation: string;
    data_sources: string[];
  };
  population_services: {
    population_density: string;
    market_demand: string;
    service_area_analysis: string;
    data_sources: string[];
  };
  satellite_optimization: {
    pass_optimization: string;
    coverage_efficiency: string;
    elevation_angles: string;
    line_of_sight: string;
    constellation_data: string;
  };
  crown_land_analysis: {
    land_availability: string;
    regulatory_zones: string;
    land_use_classification: string;
    state_specific_info: string;
    approval_guidance: string;
  };
}
