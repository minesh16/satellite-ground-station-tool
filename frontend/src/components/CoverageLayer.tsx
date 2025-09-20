import React from 'react';
import { Polygon, Popup } from 'react-leaflet';
import { Typography, Box, Chip } from '@mui/material';
import { CoverageArea } from '../types';

interface CoverageLayerProps {
  coverageAreas: CoverageArea[];
  visible: boolean;
  color: string;
  fillOpacity?: number;
  type: 'mobile' | 'nbn';
}

const CoverageLayer: React.FC<CoverageLayerProps> = ({
  coverageAreas,
  visible,
  color,
  fillOpacity = 0.3,
  type,
}) => {
  console.log(`CoverageLayer ${type}:`, { visible, count: coverageAreas?.length, color });
  
  if (!visible || !coverageAreas || coverageAreas.length === 0) {
    console.log(`CoverageLayer ${type}: Not rendering - visible: ${visible}, count: ${coverageAreas?.length}`);
    return null;
  }

  const renderPolygon = (area: CoverageArea, index: number) => {
    try {
      let coordinateRing: number[][] = [];
      
      if (area.geometry?.type === 'Polygon') {
        // Polygon coordinates: [[[lng, lat], [lng, lat], ...]]
        coordinateRing = area.geometry.coordinates[0] as number[][];
      } else if (area.geometry?.type === 'MultiPolygon') {
        // MultiPolygon coordinates: [[[[lng, lat], [lng, lat], ...], ...], ...]
        // Take the first polygon's first ring
        coordinateRing = (area.geometry.coordinates as any)[0][0] as number[][];
      } else {
        console.warn(`Unsupported geometry type: ${area.geometry?.type}`);
        return null;
      }

      if (!coordinateRing || coordinateRing.length === 0) {
        console.warn(`No coordinates found for ${type} area:`, area.id);
        return null;
      }

      // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
      const leafletPositions: [number, number][] = coordinateRing.map(coord => [coord[1], coord[0]]);
      
      if (leafletPositions.length === 0) {
        return null;
      }

      return (
        <Polygon
          key={`${area.id || index}-${type}`}
          positions={leafletPositions}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: 2,
            opacity: 0.8,
          }}
        >
          <Popup>
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="h6" gutterBottom>
                {type === 'mobile' ? 'Mobile Coverage' : 'NBN Coverage'}
              </Typography>
              
              <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {area.carrier && (
                  <Chip
                    label={area.carrier}
                    color="primary"
                    size="small"
                  />
                )}
                {area.technology && (
                  <Chip
                    label={area.technology}
                    variant="outlined"
                    size="small"
                  />
                )}
                {area.coverage_type && (
                  <Chip
                    label={area.coverage_type}
                    color="secondary"
                    size="small"
                  />
                )}
              </Box>

              {area.signal_strength && (
                <Typography variant="body2">
                  Signal Strength: {area.signal_strength}
                </Typography>
              )}
              
              {area.service_category && (
                <Typography variant="body2">
                  Service: {area.service_category}
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Coverage Area ID: {area.id || `${type}-${index}`}
              </Typography>
            </Box>
          </Popup>
        </Polygon>
      );
    } catch (error) {
      console.warn('Error rendering coverage polygon:', error, area);
      return null;
    }
  };

  return (
    <>
      {coverageAreas.map((area, index) => renderPolygon(area, index))}
    </>
  );
};

export default CoverageLayer;
