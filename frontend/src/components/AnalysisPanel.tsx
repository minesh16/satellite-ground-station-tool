import React, { useState } from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Button,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Toolbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  Tune as TuneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { AnalysisParameters, Site } from '../types';
import { apiService } from '../services/api';

interface AnalysisPanelProps {
  onAnalysisComplete: (results: any[], fullAnalysisData?: any) => void;
  selectedSites: Site[];
  mapBounds?: {north: number, south: number, east: number, west: number} | null;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  onAnalysisComplete,
  selectedSites,
  mapBounds,
}) => {
  const [parameters, setParameters] = useState<AnalysisParameters>({
    proximityToBackhaul: 20,
    populationDensity: 15,
    terrainSuitability: 15,
    regulatoryCompliance: 15,
    costEffectiveness: 15,
    satelliteOptimization: 10,
    marketDemand: 10,
    maxSites: 10,
    searchRadius: 50,
    excludeZones: [],
    useAdvancedAnalysis: true,
    elevationAnalysis: true,
    crownLandAnalysis: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExcludeZone, setNewExcludeZone] = useState('');

  const handleParameterChange = (
    parameter: keyof AnalysisParameters,
    value: number | string | string[] | boolean
  ) => {
    setParameters(prev => ({
      ...prev,
      [parameter]: value,
    }));
  };

  const handleAddExcludeZone = () => {
    if (newExcludeZone.trim()) {
      handleParameterChange('excludeZones', [
        ...parameters.excludeZones,
        newExcludeZone.trim(),
      ]);
      setNewExcludeZone('');
    }
  };

  const handleRemoveExcludeZone = (zone: string) => {
    handleParameterChange(
      'excludeZones',
      parameters.excludeZones.filter(z => z !== zone)
    );
  };

  const validateParameters = (): boolean => {
    const totalWeight =
      parameters.proximityToBackhaul +
      parameters.populationDensity +
      parameters.terrainSuitability +
      parameters.regulatoryCompliance +
      parameters.costEffectiveness +
      (parameters.satelliteOptimization || 0) +
      (parameters.marketDemand || 0);

    if (totalWeight !== 100) {
      setError('Parameter weights must sum to 100%');
      return false;
    }

    if (parameters.maxSites < 1 || parameters.maxSites > 50) {
      setError('Number of sites must be between 1 and 50');
      return false;
    }

    setError(null);
    return true;
  };

  const handleRunAnalysis = async () => {
    if (!validateParameters()) return;

    try {
      setLoading(true);
      setError(null);

      // Convert map bounds to bounding box format for analysis
      const analysisParams = { ...parameters };
      if (mapBounds) {
        analysisParams.boundingBox = [
          mapBounds.west,   // minLng
          mapBounds.south,  // minLat
          mapBounds.east,   // maxLng
          mapBounds.north   // maxLat
        ];
      }

      const result = await apiService.generateCandidateSites(analysisParams);
      onAnalysisComplete(result.sites || [], result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Analysis failed. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalWeight =
    parameters.proximityToBackhaul +
    parameters.populationDensity +
    parameters.terrainSuitability +
    parameters.regulatoryCompliance +
    parameters.costEffectiveness +
    (parameters.satelliteOptimization || 0) +
    (parameters.marketDemand || 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <TuneIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Analysis Parameters</Typography>
      </Toolbar>
      
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {mapBounds && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Analysis will be performed on the current map view area:
            <br />
            North: {mapBounds.north.toFixed(4)}, South: {mapBounds.south.toFixed(4)}
            <br />
            East: {mapBounds.east.toFixed(4)}, West: {mapBounds.west.toFixed(4)}
          </Alert>
        )}

        {!mapBounds && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Pan or zoom the map to set the analysis area. Currently using default Australia-wide bounds.
          </Alert>
        )}

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Factor Weights</Typography>
            <Chip
              label={`${totalWeight}%`}
              color={totalWeight === 100 ? 'success' : 'error'}
              size="small"
              sx={{ ml: 1 }}
            />
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Proximity to Backhaul: {parameters.proximityToBackhaul}%
              </Typography>
              <Slider
                value={parameters.proximityToBackhaul}
                onChange={(_, value) =>
                  handleParameterChange('proximityToBackhaul', value as number)
                }
                min={0}
                max={50}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Population Density: {parameters.populationDensity}%
              </Typography>
              <Slider
                value={parameters.populationDensity}
                onChange={(_, value) =>
                  handleParameterChange('populationDensity', value as number)
                }
                min={0}
                max={50}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Terrain Suitability: {parameters.terrainSuitability}%
              </Typography>
              <Slider
                value={parameters.terrainSuitability}
                onChange={(_, value) =>
                  handleParameterChange('terrainSuitability', value as number)
                }
                min={0}
                max={50}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Regulatory Compliance: {parameters.regulatoryCompliance}%
              </Typography>
              <Slider
                value={parameters.regulatoryCompliance}
                onChange={(_, value) =>
                  handleParameterChange('regulatoryCompliance', value as number)
                }
                min={0}
                max={30}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 15, label: '15%' },
                  { value: 30, label: '30%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Cost Effectiveness: {parameters.costEffectiveness}%
              </Typography>
              <Slider
                value={parameters.costEffectiveness}
                onChange={(_, value) =>
                  handleParameterChange('costEffectiveness', value as number)
                }
                min={0}
                max={30}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 15, label: '15%' },
                  { value: 30, label: '30%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Satellite Optimization: {parameters.satelliteOptimization || 0}%
              </Typography>
              <Slider
                value={parameters.satelliteOptimization || 0}
                onChange={(_, value) =>
                  handleParameterChange('satelliteOptimization', value as number)
                }
                min={0}
                max={20}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 10, label: '10%' },
                  { value: 20, label: '20%' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                Market Demand: {parameters.marketDemand || 0}%
              </Typography>
              <Slider
                value={parameters.marketDemand || 0}
                onChange={(_, value) =>
                  handleParameterChange('marketDemand', value as number)
                }
                min={0}
                max={20}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 10, label: '10%' },
                  { value: 20, label: '20%' },
                ]}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Advanced Options</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Enable advanced analysis features:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input
                    type="checkbox"
                    checked={parameters.useAdvancedAnalysis}
                    onChange={(e) =>
                      handleParameterChange('useAdvancedAnalysis', e.target.checked)
                    }
                  />
                  <Typography variant="body2">Use advanced analysis engine</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input
                    type="checkbox"
                    checked={parameters.elevationAnalysis}
                    onChange={(e) =>
                      handleParameterChange('elevationAnalysis', e.target.checked)
                    }
                  />
                  <Typography variant="body2">Include elevation analysis (ELVIS API)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input
                    type="checkbox"
                    checked={parameters.crownLandAnalysis}
                    onChange={(e) =>
                      handleParameterChange('crownLandAnalysis', e.target.checked)
                    }
                  />
                  <Typography variant="body2">Include Crown land analysis</Typography>
                </Box>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Search Parameters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Maximum Sites"
                type="number"
                value={parameters.maxSites}
                onChange={(e) =>
                  handleParameterChange('maxSites', parseInt(e.target.value) || 1)
                }
                inputProps={{ min: 1, max: 50 }}
                fullWidth
                helperText="Number of candidate sites to generate (1-50)"
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                label="Search Radius (km)"
                type="number"
                value={parameters.searchRadius}
                onChange={(e) =>
                  handleParameterChange('searchRadius', parseInt(e.target.value) || 1)
                }
                inputProps={{ min: 1, max: 200 }}
                fullWidth
                helperText="Radius to search for candidate sites"
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Exclusion Zones</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Add Exclusion Zone"
                value={newExcludeZone}
                onChange={(e) => setNewExcludeZone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddExcludeZone()}
                fullWidth
                helperText="e.g., 'National Parks', 'Urban Areas', 'Military Zones'"
                sx={{ mb: 1 }}
              />
              <Button
                onClick={handleAddExcludeZone}
                variant="outlined"
                size="small"
                disabled={!newExcludeZone.trim()}
              >
                Add Zone
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {parameters.excludeZones.map((zone, index) => (
                <Chip
                  key={index}
                  label={zone}
                  onDelete={() => handleRemoveExcludeZone(zone)}
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {selectedSites.length > 0 && (
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Selected Sites ({selectedSites.length})
            </Typography>
            <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
              {selectedSites.map((site) => (
                <Box
                  key={site.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                    p: 1,
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <LocationIcon color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {site.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          onClick={handleRunAnalysis}
          variant="contained"
          fullWidth
          size="large"
          disabled={loading || totalWeight !== 100}
          startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
        >
          {loading ? 'Running Analysis...' : 'Generate Candidate Sites'}
        </Button>
      </Box>
    </Box>
  );
};

export default AnalysisPanel;
