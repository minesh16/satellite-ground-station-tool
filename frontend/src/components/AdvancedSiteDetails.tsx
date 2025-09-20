import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Satellite as SatelliteIcon,
  Terrain as TerrainIcon,
  People as PeopleIcon,
  Landscape as LandscapeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Site } from '../types';
import { apiService } from '../services/api';

interface AdvancedSiteDetailsProps {
  site: Site;
  onAnalysisComplete?: (data: any) => void;
}

const AdvancedSiteDetails: React.FC<AdvancedSiteDetailsProps> = ({
  site,
  onAnalysisComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [advancedData, setAdvancedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdvancedAnalysis();
  }, [site.latitude, site.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAdvancedAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.getComprehensiveAnalysis(site.longitude, site.latitude);
      setAdvancedData(data.advanced_analysis);
      onAnalysisComplete?.(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load advanced analysis');
      console.error('Advanced analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading advanced analysis...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!advancedData) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No advanced analysis data available for this site.
      </Alert>
    );
  }

  const ScoreIndicator: React.FC<{ value: number; label: string; color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' }> = 
    ({ value, label, color = 'primary' }) => (
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>
          {label}: {(value * 100).toFixed(1)}%
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={value * 100} 
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
    );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon />
        Advanced Site Analysis
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Comprehensive analysis for {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
      </Typography>

      {/* Overall Score */}
      <Card sx={{ mb: 2, backgroundColor: 'primary.light', color: 'white' }}>
        <CardContent>
          <Typography variant="h4" component="div">
            {(advancedData.overall_advanced_score * 100).toFixed(1)}%
          </Typography>
          <Typography variant="body2">
            Overall Advanced Score
          </Typography>
        </CardContent>
      </Card>

      {/* Elevation Analysis */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerrainIcon />
            <Typography variant="h6">Elevation Analysis</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {advancedData.elevation_analysis && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Elevation</Typography>
                  <Typography variant="h6">
                    {advancedData.elevation_analysis.elevation_meters.toFixed(0)}m
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Data Source</Typography>
                  <Typography variant="body2">
                    {advancedData.elevation_analysis.data_source}
                  </Typography>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Terrain Suitability Assessment:
                </Typography>
                {advancedData.elevation_analysis.elevation_meters > 200 && 
                 advancedData.elevation_analysis.elevation_meters < 800 ? (
                  <Chip icon={<CheckIcon />} label="Optimal elevation range" color="success" size="small" />
                ) : advancedData.elevation_analysis.elevation_meters < 200 ? (
                  <Chip icon={<WarningIcon />} label="Low elevation - may have propagation limitations" color="warning" size="small" />
                ) : (
                  <Chip icon={<WarningIcon />} label="High elevation - challenging for ground infrastructure" color="warning" size="small" />
                )}
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Satellite Optimization */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SatelliteIcon />
            <Typography variant="h6">Satellite Coverage</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {advancedData.satellite_optimization && (
            <Box>
              <ScoreIndicator 
                value={advancedData.satellite_optimization.optimization_score} 
                label="Optimization Score"
                color="primary"
              />
              
              {advancedData.satellite_optimization.pass_metrics && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Daily Passes</Typography>
                    <Typography variant="h6">
                      {advancedData.satellite_optimization.pass_metrics.total_daily_passes}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Avg Duration</Typography>
                    <Typography variant="h6">
                      {advancedData.satellite_optimization.pass_metrics.avg_pass_duration_minutes}min
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Max Elevation</Typography>
                    <Typography variant="h6">
                      {advancedData.satellite_optimization.pass_metrics.max_elevation_angle.toFixed(1)}°
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Coverage Efficiency</Typography>
                    <Typography variant="h6">
                      {(advancedData.satellite_optimization.pass_metrics.coverage_efficiency * 100).toFixed(1)}%
                    </Typography>
                  </Grid>
                </Grid>
              )}

              {advancedData.satellite_optimization.recommendations && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Recommendations:</Typography>
                  <List dense>
                    {advancedData.satellite_optimization.recommendations.map((rec: string, index: number) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <InfoIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Market Analysis */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon />
            <Typography variant="h6">Market Analysis</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {advancedData.market_analysis && (
            <Box>
              <ScoreIndicator 
                value={advancedData.market_analysis.overall_demand_score} 
                label="Market Demand Score"
                color="secondary"
              />
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Population Density</Typography>
                  <Typography variant="h6">
                    {advancedData.market_analysis.population_density.toFixed(1)} people/km²
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Service Area Population</Typography>
                  <Typography variant="h6">
                    {advancedData.market_analysis.estimated_population?.toLocaleString() || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              {advancedData.market_analysis.market_characteristics && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Market Characteristics:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {advancedData.market_analysis.market_characteristics.is_metropolitan && (
                      <Chip label="Metropolitan" color="primary" size="small" />
                    )}
                    {advancedData.market_analysis.market_characteristics.is_urban && (
                      <Chip label="Urban" color="primary" size="small" />
                    )}
                    {advancedData.market_analysis.market_characteristics.is_remote && (
                      <Chip label="Remote" color="warning" size="small" />
                    )}
                  </Box>
                </Box>
              )}

              {advancedData.market_analysis.demand_factors && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Demand Factors:</Typography>
                  <ScoreIndicator 
                    value={advancedData.market_analysis.demand_factors.internet_demand} 
                    label="Internet Demand"
                    color="success"
                  />
                  <ScoreIndicator 
                    value={advancedData.market_analysis.demand_factors.business_demand} 
                    label="Business Demand"
                    color="success"
                  />
                  <ScoreIndicator 
                    value={advancedData.market_analysis.demand_factors.infrastructure_gap} 
                    label="Infrastructure Gap"
                    color="warning"
                  />
                </Box>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Crown Land Analysis */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LandscapeIcon />
            <Typography variant="h6">Crown Land & Regulatory</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {advancedData.crown_land_analysis && (
            <Box>
              <ScoreIndicator 
                value={advancedData.crown_land_analysis.land_availability_score} 
                label="Land Availability Score"
                color="success"
              />
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">State/Territory</Typography>
                  <Typography variant="h6">
                    {advancedData.crown_land_analysis.state_territory}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Land Use Category</Typography>
                  <Typography variant="body2">
                    {advancedData.crown_land_analysis.land_use?.category || 'Unknown'}
                  </Typography>
                </Grid>
              </Grid>

              {advancedData.crown_land_analysis.land_use?.description && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {advancedData.crown_land_analysis.land_use.description}
                  </Typography>
                </Box>
              )}

              {advancedData.crown_land_analysis.regulatory_analysis && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Regulatory Status:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip 
                      label={`Restriction Level: ${advancedData.crown_land_analysis.regulatory_analysis.overall_restriction_level}`}
                      color={
                        advancedData.crown_land_analysis.regulatory_analysis.overall_restriction_level === 'low' ? 'success' :
                        advancedData.crown_land_analysis.regulatory_analysis.overall_restriction_level === 'medium' ? 'warning' : 'error'
                      }
                      size="small"
                    />
                    {advancedData.crown_land_analysis.regulatory_analysis.clearance_required && (
                      <Chip label="High-level clearance required" color="error" size="small" />
                    )}
                  </Box>

                  {advancedData.crown_land_analysis.regulatory_analysis.exclusions?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" gutterBottom>Exclusion Zones:</Typography>
                      {advancedData.crown_land_analysis.regulatory_analysis.exclusions.map((exclusion: any, index: number) => (
                        <Chip 
                          key={index}
                          label={exclusion.description}
                          color={exclusion.restriction_level === 'very_high' ? 'error' : 'warning'}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {advancedData.crown_land_analysis.recommendations && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Recommendations:</Typography>
                  <List dense>
                    {advancedData.crown_land_analysis.recommendations.map((rec: string, index: number) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {advancedData.crown_land_analysis.next_steps && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>Next Steps:</Typography>
                  <List dense>
                    {advancedData.crown_land_analysis.next_steps.map((step: string, index: number) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <Typography variant="body2" color="primary">
                            {index + 1}.
                          </Typography>
                        </ListItemIcon>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default AdvancedSiteDetails;
