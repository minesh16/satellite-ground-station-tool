import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Chip,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  Info as InfoIcon,
} from '@mui/icons-material';
import L from 'leaflet';
import { Site, InfrastructureLayer, CoverageArea } from '../types';
import { apiService } from '../services/api';
import CoverageLayer from './CoverageLayer';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons for different site types
const createCustomIcon = (color: string, type: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="color: white; font-size: 12px; font-weight: bold;">
          ${type === 'mobile' ? 'M' : type === 'nbn' ? 'N' : 'C'}
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

interface MapComponentProps {
  analysisResults: any[];
  selectedSites: Site[];
  onSiteSelect: (site: Site) => void;
  onBoundsChange?: (bounds: {north: number, south: number, east: number, west: number}) => void;
}

const LayerControl: React.FC<{
  layers: InfrastructureLayer[];
  onLayerToggle: (layerId: string) => void;
}> = ({ layers, onLayerToggle }) => {
  // Group layers by category
  const pointLayers = layers.filter(l => ['mobile', 'candidate'].includes(l.type));
  const coverageLayers = layers.filter(l => l.type.includes('coverage'));

  const renderLayerItem = (layer: InfrastructureLayer) => (
    <FormControlLabel
      key={layer.id}
      control={
        <Switch
          checked={layer.visible}
          onChange={() => onLayerToggle(layer.id)}
          color="primary"
          size="small"
        />
      }
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: layer.type.includes('coverage') ? '2px' : '50%',
              backgroundColor: layer.color,
              opacity: layer.type.includes('coverage') ? layer.fillOpacity || 0.3 : 1,
              border: layer.type.includes('coverage') ? `1px solid ${layer.color}` : 'none',
            }}
          />
          <Typography variant="body2">{layer.name}</Typography>
        </Box>
      }
      sx={{ display: 'block', mb: 0.5 }}
    />
  );

  return (
    <Card
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        minWidth: 220,
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="h6" gutterBottom>
          Map Layers
        </Typography>
        
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
          Infrastructure Points
        </Typography>
        {pointLayers.map(renderLayerItem)}
        
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
          Coverage Areas
        </Typography>
        {coverageLayers.map(renderLayerItem)}
      </CardContent>
    </Card>
  );
};

const MapEventHandler: React.FC<{
  onBoundsChange: (bounds: any) => void;
}> = ({ onBoundsChange }) => {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
  });

  return null;
};

const MapDebugger: React.FC = () => {
  const map = useMap();
  
  React.useEffect(() => {
    console.log('MapDebugger: Map instance:', map);
    console.log('MapDebugger: Map container:', map.getContainer());
    console.log('MapDebugger: Map zoom:', map.getZoom());
    console.log('MapDebugger: Map center:', map.getCenter());
    
    // Listen for tile events
    map.on('tileload', () => console.log('Tile loaded'));
    map.on('tileerror', (e) => console.error('Tile error:', e));
    map.on('tileloadstart', () => console.log('Tile load started'));
    
    return () => {
      map.off('tileload');
      map.off('tileerror');
      map.off('tileloadstart');
    };
  }, [map]);

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({
  analysisResults,
  selectedSites,
  onSiteSelect,
  onBoundsChange,
}) => {
  const [mobileSites, setMobileSites] = useState<Site[]>([]);
  const [nbnWirelessCoverage, setNbnWirelessCoverage] = useState<CoverageArea[]>([]);
  const [nbnFixedCoverage, setNbnFixedCoverage] = useState<CoverageArea[]>([]);
  const [mobileCoverage] = useState<CoverageArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState<InfrastructureLayer[]>([
    {
      id: 'mobile',
      name: 'Mobile Towers',
      visible: true,
      type: 'mobile',
      color: '#2196f3',
    },
    {
      id: 'mobile-coverage',
      name: 'Mobile Coverage',
      visible: false,
      type: 'mobile-coverage',
      color: '#1976d2',
      fillOpacity: 0.2,
      strokeWeight: 1,
    },
    {
      id: 'nbn-wireless',
      name: 'NBN Wireless',
      visible: true,  // Make visible by default
      type: 'nbn-coverage',
      color: '#4caf50',
      fillOpacity: 0.3,
      strokeWeight: 2,
    },
    {
      id: 'nbn-fixed',
      name: 'NBN Fixed',
      visible: true,  // Make visible by default
      type: 'nbn-coverage',
      color: '#2e7d32',
      fillOpacity: 0.4,
      strokeWeight: 2,
    },
    {
      id: 'candidates',
      name: 'Candidate Sites',
      visible: true,
      type: 'candidate',
      color: '#ff9800',
    },
  ]);

  // Default center for Australia (adjusted to show Western Australia where NBN coverage is)
  const defaultCenter: [number, number] = [-31.9505, 115.8605]; // Perth area
  const defaultZoom = 6; // Reduced zoom to show more coverage areas

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [mobileData, nbnCoverageData] = await Promise.all([
        apiService.getMobileSites().catch(() => []),
        apiService.getNbnCoverage().catch(() => []),
      ]);
      
      setMobileSites(Array.isArray(mobileData) ? mobileData : []);
      
      // Separate NBN coverage by type
      const allNbnCoverage = Array.isArray(nbnCoverageData) ? nbnCoverageData : [];
      const wirelessCoverage = allNbnCoverage.filter(item => item.service_category === 'wireless');
      const fixedCoverage = allNbnCoverage.filter(item => item.service_category === 'fixed');
      
      setNbnWirelessCoverage(wirelessCoverage);
      setNbnFixedCoverage(fixedCoverage);
      
      console.log('Loaded mobile sites:', mobileData.length);
      console.log('Loaded NBN wireless coverage:', wirelessCoverage.length);
      console.log('Loaded NBN fixed coverage:', fixedCoverage.length);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setMobileSites([]);
      setNbnWirelessCoverage([]);
      setNbnFixedCoverage([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBoundsChange = async (bounds: any) => {
    try {
      // Notify parent component of bounds change
      onBoundsChange?.(bounds);
      
      // Only reload mobile sites on bounds change, keep NBN coverage as is
      const mobileData = await apiService.getMobileSites({ bounds });
      setMobileSites(Array.isArray(mobileData) ? mobileData : []);
      // Don't reload NBN coverage on every bounds change to avoid it disappearing
    } catch (error) {
      console.error('Error loading data for bounds:', error);
      setMobileSites([]);
    }
  };

  const handleLayerToggle = (layerId: string) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const getMarkerIcon = (site: Site) => {
    const isSelected = selectedSites.some(s => s.id === site.id);
    let color = '#757575';
    
    if (site.type === 'mobile') {
      switch (site.carrier) {
        case 'telstra':
          color = '#ff6b6b';
          break;
        case 'optus':
          color = '#4ecdc4';
          break;
        case 'tpg':
          color = '#45b7d1';
          break;
        default:
          color = '#2196f3';
      }
    } else if (site.type === 'nbn') {
      color = '#4caf50';
    } else if (site.type === 'candidate') {
      color = '#ff9800';
    }

    if (isSelected) {
      color = '#e91e63';
    }

    return createCustomIcon(color, site.type);
  };

  const renderSiteMarkers = (sites: Site[], layerVisible: boolean) => {
    if (!layerVisible || !sites || !Array.isArray(sites)) return null;

    return sites.map((site) => (
      <Marker
        key={site.id}
        position={[site.latitude, site.longitude]}
        icon={getMarkerIcon(site)}
        eventHandlers={{
          click: () => onSiteSelect(site),
        }}
      >
        <Popup>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="h6" gutterBottom>
              {site.name}
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Chip
                label={site.type.toUpperCase()}
                color={
                  site.type === 'mobile'
                    ? 'primary'
                    : site.type === 'nbn'
                    ? 'success'
                    : 'warning'
                }
                size="small"
              />
              {site.carrier && (
                <Chip
                  label={site.carrier.toUpperCase()}
                  variant="outlined"
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Lat: {site.latitude.toFixed(6)}
              <br />
              Lng: {site.longitude.toFixed(6)}
            </Typography>
            {site.technology && (
              <Typography variant="body2">
                Technology: {site.technology}
              </Typography>
            )}
            {site.score && (
              <Typography variant="body2">
                Score: {site.score.toFixed(2)}
              </Typography>
            )}
            <Box sx={{ mt: 1 }}>
              <IconButton
                size="small"
                onClick={() => onSiteSelect(site)}
                color={selectedSites.some(s => s.id === site.id) ? 'secondary' : 'default'}
              >
                <InfoIcon />
              </IconButton>
            </Box>
          </Box>
        </Popup>
      </Marker>
    ));
  };

  const mobileLayer = layers.find(l => l.id === 'mobile');
  const mobileCoverageLayer = layers.find(l => l.id === 'mobile-coverage');
  const nbnWirelessLayer = layers.find(l => l.id === 'nbn-wireless');
  const nbnFixedLayer = layers.find(l => l.id === 'nbn-fixed');
  const candidatesLayer = layers.find(l => l.id === 'candidates');

  return (
    <Box sx={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ 
          height: '100%', 
          width: '100%'
        }}
        zoomControl={true}
        whenReady={() => {
          console.log('Map is ready');
          setLoading(false);
        }}
      >
        {/* CartoDB tiles - verified working with debugging */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          subdomains={['a', 'b', 'c', 'd']}
          eventHandlers={{
            loading: () => console.log('🔄 Tiles loading...'),
            load: () => console.log('✅ Tiles loaded successfully!'),
            tileerror: (e) => console.error('❌ Tile load error:', e),
            tileloadstart: () => console.log('🚀 Tile load started'),
            add: () => console.log('➕ TileLayer added to map'),
          }}
        />

        <LayersControl position="topleft">
          <LayersControl.BaseLayer name="CartoDB Light">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="CartoDB Dark">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenTopoMap">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapEventHandler onBoundsChange={handleBoundsChange} />
        <MapDebugger />

        {/* Render coverage layers (polygons) */}
        <CoverageLayer
          coverageAreas={nbnWirelessCoverage}
          visible={nbnWirelessLayer?.visible || false}
          color={nbnWirelessLayer?.color || '#4caf50'}
          fillOpacity={nbnWirelessLayer?.fillOpacity || 0.3}
          type="nbn"
        />
        
        <CoverageLayer
          coverageAreas={nbnFixedCoverage}
          visible={nbnFixedLayer?.visible || false}
          color={nbnFixedLayer?.color || '#2e7d32'}
          fillOpacity={nbnFixedLayer?.fillOpacity || 0.4}
          type="nbn"
        />
        
        <CoverageLayer
          coverageAreas={mobileCoverage}
          visible={mobileCoverageLayer?.visible || false}
          color={mobileCoverageLayer?.color || '#1976d2'}
          fillOpacity={mobileCoverageLayer?.fillOpacity || 0.2}
          type="mobile"
        />

        {/* Render site markers (on top of polygons) */}
        {renderSiteMarkers(mobileSites, mobileLayer?.visible || false)}
        {renderSiteMarkers(analysisResults, candidatesLayer?.visible || false)}
      </MapContainer>

      <LayerControl layers={layers} onLayerToggle={handleLayerToggle} />

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 2,
            borderRadius: 1,
          }}
        >
          <Typography>Loading map data...</Typography>
        </Box>
      )}
    </Box>
  );
};

export default MapComponent;
