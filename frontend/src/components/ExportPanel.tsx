import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  TextField,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PictureAsPdf as PdfIcon,
  Map as MapIcon,
  TableChart as CsvIcon,
  CloudDownload as CloudDownloadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { ExportOptions } from '../types';
import { apiService } from '../services/api';

interface ExportPanelProps {
  analysisData: any;
  onExportComplete?: (type: string, success: boolean) => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  analysisData,
  onExportComplete,
}) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [pdfOptions, setPdfOptions] = useState<ExportOptions>({
    title: 'Satellite Ground Station Site Analysis Report',
    includeDetailedAnalysis: true,
    includeRecommendations: true,
    includeMaps: false,
  });

  const [geoJsonOptions, setGeoJsonOptions] = useState<ExportOptions>({
    includeAllData: true,
    maxFeatures: 1000,
    minScore: 0,
  });

  const [csvOptions, setCsvOptions] = useState<ExportOptions>({
    includeDetailedScores: true,
    includeCoordinates: true,
    maxRecords: 1000,
    minScore: 0,
  });

  const handleExport = async (format: 'pdf' | 'geojson' | 'csv') => {
    if (!analysisData || !analysisData.analysis?.candidate_sites?.length) {
      setError('No analysis data available for export');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, [format]: true }));
      setError(null);
      setSuccess(null);

      let blob: Blob;
      let filename: string;
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case 'pdf':
          blob = await apiService.exportToPDF(analysisData, pdfOptions);
          filename = `ground-station-analysis-${timestamp}.pdf`;
          break;
        case 'geojson':
          const geoJsonData = await apiService.exportToGeoJSON(analysisData, geoJsonOptions);
          blob = new Blob([JSON.stringify(geoJsonData, null, 2)], { type: 'application/geo+json' });
          filename = `ground-station-sites-${timestamp}.geojson`;
          break;
        case 'csv':
          blob = await apiService.exportToCSV(analysisData, csvOptions);
          filename = `ground-station-analysis-${timestamp}.csv`;
          break;
      }

      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`${format.toUpperCase()} export completed successfully`);
      onExportComplete?.(format, true);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || `Failed to export ${format.toUpperCase()}`;
      setError(errorMessage);
      onExportComplete?.(format, false);
      console.error(`Export error (${format}):`, err);
    } finally {
      setLoading(prev => ({ ...prev, [format]: false }));
    }
  };

  const updatePdfOptions = (key: keyof ExportOptions, value: any) => {
    setPdfOptions(prev => ({ ...prev, [key]: value }));
  };

  const updateGeoJsonOptions = (key: keyof ExportOptions, value: any) => {
    setGeoJsonOptions(prev => ({ ...prev, [key]: value }));
  };

  const updateCsvOptions = (key: keyof ExportOptions, value: any) => {
    setCsvOptions(prev => ({ ...prev, [key]: value }));
  };

  const isDataAvailable = analysisData?.analysis?.candidate_sites?.length > 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        p: 2,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        borderRadius: '8px 8px 0 0',
        margin: '8px 8px 0 8px'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CloudDownloadIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Export Analysis Results
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Download your analysis data in multiple formats
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      
      {!isDataAvailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No analysis data available. Run an analysis first to enable exports.
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {isDataAvailable && (
        <Box sx={{ mb: 2 }}>
          <Chip 
            label={`${analysisData.analysis.candidate_sites.length} sites available`}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/* PDF Export */}
      <Accordion sx={{ 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
        borderRadius: '12px !important',
        mb: 2,
        '&:before': { display: 'none' }
      }}>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
            borderRadius: '12px 12px 0 0',
            '&.Mui-expanded': {
              borderRadius: '12px 12px 0 0',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PdfIcon sx={{ color: 'error.main', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                PDF Report
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Professional analysis report with charts and insights
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Report Title"
              value={pdfOptions.title}
              onChange={(e) => updatePdfOptions('title', e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={pdfOptions.includeDetailedAnalysis}
                  onChange={(e) => updatePdfOptions('includeDetailedAnalysis', e.target.checked)}
                />
              }
              label="Include detailed site analysis"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={pdfOptions.includeRecommendations}
                  onChange={(e) => updatePdfOptions('includeRecommendations', e.target.checked)}
                />
              }
              label="Include recommendations section"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={pdfOptions.includeMaps}
                  onChange={(e) => updatePdfOptions('includeMaps', e.target.checked)}
                />
              }
              label="Include map visualizations (experimental)"
            />
          </Box>
          
          <Button
            variant="contained"
            startIcon={loading.pdf ? <CircularProgress size={20} /> : <PdfIcon />}
            onClick={() => handleExport('pdf')}
            disabled={!isDataAvailable || loading.pdf}
            fullWidth
          >
            {loading.pdf ? 'Generating PDF...' : 'Export PDF Report'}
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* GeoJSON Export */}
      <Accordion sx={{ 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
        borderRadius: '12px !important',
        mb: 2,
        '&:before': { display: 'none' }
      }}>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
            borderRadius: '12px 12px 0 0',
            '&.Mui-expanded': {
              borderRadius: '12px 12px 0 0',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <MapIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                GeoJSON (GIS Data)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Geographic data for QGIS, ArcGIS, and mapping tools
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={geoJsonOptions.includeAllData}
                  onChange={(e) => updateGeoJsonOptions('includeAllData', e.target.checked)}
                />
              }
              label="Include all analysis data in properties"
            />
            
            <TextField
              label="Maximum Features"
              type="number"
              value={geoJsonOptions.maxFeatures}
              onChange={(e) => updateGeoJsonOptions('maxFeatures', parseInt(e.target.value) || 1000)}
              inputProps={{ min: 1, max: 10000 }}
              fullWidth
              sx={{ mt: 2, mb: 2 }}
              helperText="Maximum number of sites to include"
            />
            
            <TextField
              label="Minimum Score Threshold"
              type="number"
              value={geoJsonOptions.minScore}
              onChange={(e) => updateGeoJsonOptions('minScore', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              fullWidth
              sx={{ mb: 2 }}
              helperText="Only include sites above this score (0-1)"
            />
          </Box>
          
          <Button
            variant="contained"
            startIcon={loading.geojson ? <CircularProgress size={20} /> : <MapIcon />}
            onClick={() => handleExport('geojson')}
            disabled={!isDataAvailable || loading.geojson}
            fullWidth
          >
            {loading.geojson ? 'Generating GeoJSON...' : 'Export GeoJSON'}
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* CSV Export */}
      <Accordion sx={{ 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
        borderRadius: '12px !important',
        mb: 2,
        '&:before': { display: 'none' }
      }}>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            borderRadius: '12px 12px 0 0',
            '&.Mui-expanded': {
              borderRadius: '12px 12px 0 0',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CsvIcon sx={{ color: 'success.main', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CSV (Spreadsheet Data)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Structured data for Excel, Google Sheets, and analysis
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={csvOptions.includeDetailedScores}
                  onChange={(e) => updateCsvOptions('includeDetailedScores', e.target.checked)}
                />
              }
              label="Include individual factor scores"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={csvOptions.includeCoordinates}
                  onChange={(e) => updateCsvOptions('includeCoordinates', e.target.checked)}
                />
              }
              label="Include latitude/longitude coordinates"
            />
            
            <TextField
              label="Maximum Records"
              type="number"
              value={csvOptions.maxRecords}
              onChange={(e) => updateCsvOptions('maxRecords', parseInt(e.target.value) || 1000)}
              inputProps={{ min: 1, max: 10000 }}
              fullWidth
              sx={{ mt: 2, mb: 2 }}
              helperText="Maximum number of sites to include"
            />
            
            <TextField
              label="Minimum Score Threshold"
              type="number"
              value={csvOptions.minScore}
              onChange={(e) => updateCsvOptions('minScore', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              fullWidth
              sx={{ mb: 2 }}
              helperText="Only include sites above this score (0-1)"
            />
          </Box>
          
          <Button
            variant="contained"
            startIcon={loading.csv ? <CircularProgress size={20} /> : <CsvIcon />}
            onClick={() => handleExport('csv')}
            disabled={!isDataAvailable || loading.csv}
            fullWidth
          >
            {loading.csv ? 'Generating CSV...' : 'Export CSV'}
          </Button>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <FileIcon sx={{ mr: 1, color: 'info.main', fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500}>
            Export Information
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Exported files will be downloaded to your default downloads folder.
          GeoJSON files can be imported into QGIS, ArcGIS, or other GIS applications.
        </Typography>
      </Box>
      </Box>
    </Box>
  );
};

export default ExportPanel;
