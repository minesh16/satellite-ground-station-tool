import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  LinearProgress,
  Toolbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Star as StarIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Assessment as AssessmentIcon,
  Analytics as AdvancedIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Site } from '../types';
import AdvancedSiteDetails from './AdvancedSiteDetails';

interface ResultsDashboardProps {
  results: Site[];
  onSiteSelect: (site: Site) => void;
  selectedSites: Site[];
}

type SortField = 'score' | 'name' | 'distance' | 'population';
type SortOrder = 'asc' | 'desc';

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  results,
  onSiteSelect,
  selectedSites,
}) => {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterText, setFilterText] = useState('');
  const [selectedSiteForDetails, setSelectedSiteForDetails] = useState<Site | null>(null);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  const filteredResults = results.filter(site =>
    site.name.toLowerCase().includes(filterText.toLowerCase()) ||
    site.id.toLowerCase().includes(filterText.toLowerCase())
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'score':
        comparison = (a.score || 0) - (b.score || 0);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'distance':
        // Placeholder for distance calculation
        comparison = 0;
        break;
      case 'population':
        comparison = (a.population_served || 0) - (b.population_served || 0);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getScoreColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const handleSiteExpand = (siteId: string) => {
    setExpandedSite(expandedSite === siteId ? null : siteId);
  };

  const handleExportResults = () => {
    const csvContent = [
      ['Site ID', 'Name', 'Latitude', 'Longitude', 'Score', 'Type'].join(','),
      ...sortedResults.map(site =>
        [
          site.id,
          site.name,
          site.latitude,
          site.longitude,
          site.score || 0,
          site.type,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'candidate_sites.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const averageScore = results.length > 0 
    ? results.reduce((sum, site) => sum + (site.score || 0), 0) / results.length 
    : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <AssessmentIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Analysis Results</Typography>
      </Toolbar>

      {results.length > 0 && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Card variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Sites: {results.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average Score: {averageScore.toFixed(1)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={averageScore}
                color={getScoreColor(averageScore)}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            placeholder="Search sites..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortField}
              label="Sort by"
              onChange={(e) => setSortField(e.target.value as SortField)}
            >
              <MenuItem value="score">Score</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="distance">Distance</MenuItem>
              <MenuItem value="population">Population</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Order</InputLabel>
            <Select
              value={sortOrder}
              label="Order"
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <MenuItem value="desc">High to Low</MenuItem>
              <MenuItem value="asc">Low to High</MenuItem>
            </Select>
          </FormControl>

          {results.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleExportResults}
              startIcon={<DownloadIcon />}
            >
              Export
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {sortedResults.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {results.length === 0
                ? 'Run an analysis to see candidate sites'
                : 'No sites match your search criteria'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 1 }}>
            {sortedResults.map((site, index) => {
              const isSelected = selectedSites.some(s => s.id === site.id);
              const isExpanded = expandedSite === site.id;

              return (
                <Card
                  key={site.id}
                  sx={{
                    mb: 1,
                    border: isSelected ? 2 : 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" component="div">
                          #{index + 1} {site.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <Chip
                            label={site.type.toUpperCase()}
                            color="primary"
                            size="small"
                          />
                          {site.score && (
                            <Chip
                              label={`Score: ${site.score.toFixed(1)}`}
                              color={getScoreColor(site.score)}
                              size="small"
                              icon={<StarIcon />}
                            />
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleSiteExpand(site.id)}
                          color={isExpanded ? 'primary' : 'default'}
                        >
                          <InfoIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setSelectedSiteForDetails(site)}
                          color="secondary"
                          title="Advanced Analysis"
                        >
                          <Badge badgeContent="+" color="primary" variant="dot">
                            <AdvancedIcon />
                          </Badge>
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onSiteSelect(site)}
                          color={isSelected ? 'primary' : 'default'}
                        >
                          <LocationIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {isExpanded && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        {site.reasoning && site.reasoning.length > 0 && (
                          <>
                            <Typography variant="subtitle2" gutterBottom>
                              Analysis Reasoning:
                            </Typography>
                            <List dense>
                              {site.reasoning.map((reason, idx) => (
                                <ListItem key={idx} sx={{ pl: 0 }}>
                                  <ListItemText
                                    primary={reason}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </>
                        )}
                        
                        {site.population_served && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Population Served: {site.population_served.toLocaleString()}
                          </Typography>
                        )}
                        
                        {site.coverage_area && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Coverage Area: {site.coverage_area} km²
                          </Typography>
                        )}

                        <Typography variant="body2" color="text.secondary">
                          Site ID: {site.id}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ pt: 0 }}>
                    <Button
                      size="small"
                      onClick={() => onSiteSelect(site)}
                      variant={isSelected ? 'contained' : 'outlined'}
                    >
                      {isSelected ? 'Selected' : 'Select Site'}
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
          </List>
        )}
      </Box>

      {/* Advanced Site Details Dialog */}
      <Dialog
        open={selectedSiteForDetails !== null}
        onClose={() => setSelectedSiteForDetails(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Advanced Site Analysis
          </Typography>
          <IconButton
            onClick={() => setSelectedSiteForDetails(null)}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedSiteForDetails && (
            <AdvancedSiteDetails
              site={selectedSiteForDetails}
              onAnalysisComplete={(data) => {
                console.log('Advanced analysis completed:', data);
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSiteForDetails(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResultsDashboard;
