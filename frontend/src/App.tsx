import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  IconButton,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  alpha,
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Satellite as SatelliteIcon,
  Tune as AnalysisIcon,
  Assessment as ResultsIcon,
  Download as ExportIcon,
  LocationSearching as LocationIcon,
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
      main: '#2563eb', // Modern blue
      light: '#3b82f6',
      dark: '#1d4ed8',
    },
    secondary: {
      main: '#7c3aed', // Modern purple
      light: '#8b5cf6',
      dark: '#6d28d9',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(145deg, #2563eb 0%, #3b82f6 100%)',
          '&:hover': {
            background: 'linear-gradient(145deg, #1d4ed8 0%, #2563eb 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 15px rgba(0, 0, 0, 0.1)',
          },
          transition: 'box-shadow 0.2s ease-in-out',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0, 0, 0, 0.06)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 72,
          fontWeight: 500,
          textTransform: 'none',
          '&.Mui-selected': {
            background: alpha('#2563eb', 0.08),
            borderRadius: 8,
            margin: '4px',
          },
        },
      },
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
          sx={{ 
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            }
          }}
        >
          <Tooltip title="Configure analysis parameters and run site optimization">
            <Tab
              icon={<AnalysisIcon sx={{ fontSize: 24 }} />}
              label="Analysis"
              sx={{ 
                minHeight: 72, 
                fontSize: '0.8rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: 'primary.main',
                }
              }}
            />
          </Tooltip>
          <Tooltip title={`View ${analysisResults.length} candidate sites and detailed results`}>
            <Tab
              icon={
                <Badge 
                  badgeContent={analysisResults.length || 0} 
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.65rem',
                      minWidth: 16,
                      height: 16,
                    }
                  }}
                >
                  <ResultsIcon sx={{ fontSize: 24 }} />
                </Badge>
              }
              label="Results"
              sx={{ 
                minHeight: 72, 
                fontSize: '0.8rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: 'primary.main',
                }
              }}
            />
          </Tooltip>
          <Tooltip title="Export analysis data in various formats">
            <Tab
              icon={<ExportIcon sx={{ fontSize: 24 }} />}
              label="Export"
              sx={{ 
                minHeight: 72, 
                fontSize: '0.8rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: 'primary.main',
                }
              }}
            />
          </Tooltip>
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
          <Toolbar sx={{ minHeight: 64 }}>
            <Tooltip title="Toggle Menu">
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, display: { sm: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <SatelliteIcon sx={{ mr: 1, fontSize: 28, color: '#60a5fa' }} />
              <LocationIcon sx={{ fontSize: 24, color: '#34d399' }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
                Satellite Ground Station Optimizer
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'none', sm: 'block' } }}>
                Advanced Location Intelligence & Analysis Platform
              </Typography>
            </Box>
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