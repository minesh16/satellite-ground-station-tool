import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Grid,
  Box,
  Drawer,
  IconButton,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Map as MapIcon,
  Tune as AnalysisIcon,
  Assessment as ResultsIcon,
  Download as ExportIcon,
} from '@mui/icons-material';
import MapComponent from './components/MapComponent';
import AnalysisPanel from './components/AnalysisPanel';
import ResultsDashboard from './components/ResultsDashboard';
import ExportPanel from './components/ExportPanel';
import 'leaflet/dist/leaflet.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const DRAWER_WIDTH = 400;

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedSites, setSelectedSites] = useState<any[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [mapBounds, setMapBounds] = useState<{north: number, south: number, east: number, west: number} | null>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleAnalysisComplete = (results: any[], fullAnalysisData?: any) => {
    setAnalysisResults(results);
    if (fullAnalysisData) {
      setAnalysisData(fullAnalysisData);
    }
    // Auto-switch to results tab after analysis
    setCurrentTab(1);
  };

  const handleSiteSelect = (site: any) => {
    setSelectedSites(prev => {
      const exists = prev.find(s => s.id === site.id);
      if (exists) {
        return prev.filter(s => s.id !== site.id);
      }
      return [...prev, site];
    });
  };

  const renderDrawerContent = () => (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab
            icon={<AnalysisIcon />}
            label="Analysis"
            sx={{ minHeight: 72, fontSize: '0.75rem' }}
          />
          <Tab
            icon={
              <Badge badgeContent={analysisResults.length || 0} color="primary">
                <ResultsIcon />
              </Badge>
            }
            label="Results"
            sx={{ minHeight: 72, fontSize: '0.75rem' }}
          />
          <Tab
            icon={<ExportIcon />}
            label="Export"
            sx={{ minHeight: 72, fontSize: '0.75rem' }}
          />
        </Tabs>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {currentTab === 0 && (
          <AnalysisPanel
            onAnalysisComplete={handleAnalysisComplete}
            selectedSites={selectedSites}
            mapBounds={mapBounds}
          />
        )}
        {currentTab === 1 && (
          <ResultsDashboard
            results={analysisResults}
            onSiteSelect={handleSiteSelect}
            selectedSites={selectedSites}
          />
        )}
        {currentTab === 2 && (
          <ExportPanel
            analysisData={analysisData}
            onExportComplete={(type, success) => {
              console.log(`Export ${type} ${success ? 'completed' : 'failed'}`);
            }}
          />
        )}
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { sm: `${DRAWER_WIDTH}px` },
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <MapIcon sx={{ mr: 2 }} />
            <Typography variant="h6" noWrap component="div">
              Satellite Ground Station Location Optimizer
            </Typography>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
          >
            {renderDrawerContent()}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
            open
          >
            {renderDrawerContent()}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 0,
            width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          }}
        >
          <Toolbar />
          <MapComponent
            analysisResults={analysisResults}
            selectedSites={selectedSites}
            onSiteSelect={handleSiteSelect}
            onBoundsChange={setMapBounds}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;