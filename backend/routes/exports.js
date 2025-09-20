/**
 * Export routes for analysis results
 * Handles PDF, GeoJSON, and CSV export endpoints
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { 
    generatePDFReport, 
    exportToGeoJSON, 
    exportToCSV,
    saveExportFile 
} = require('../services/exportService');

const router = express.Router();

/**
 * POST /api/exports/pdf
 * Generate PDF report from analysis results
 */
router.post('/pdf', asyncHandler(async (req, res) => {
    const { analysisData, options = {} } = req.body;
    
    if (!analysisData) {
        throw createError('Analysis data required for PDF export', 400);
    }
    
    const pdfBuffer = await generatePDFReport(analysisData, options);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ground-station-analysis-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
}));

/**
 * POST /api/exports/geojson
 * Export analysis results as GeoJSON
 */
router.post('/geojson', asyncHandler(async (req, res) => {
    const { analysisData, options = {} } = req.body;
    
    if (!analysisData) {
        throw createError('Analysis data required for GeoJSON export', 400);
    }
    
    const geoJsonData = exportToGeoJSON(analysisData, options);
    
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', `attachment; filename="ground-station-sites-${Date.now()}.geojson"`);
    res.json(geoJsonData);
}));

/**
 * POST /api/exports/csv
 * Export analysis results as CSV
 */
router.post('/csv', asyncHandler(async (req, res) => {
    const { analysisData, options = {} } = req.body;
    
    if (!analysisData) {
        throw createError('Analysis data required for CSV export', 400);
    }
    
    const csvData = exportToCSV(analysisData, options);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ground-station-analysis-${Date.now()}.csv"`);
    res.send(csvData);
}));

/**
 * GET /api/exports/formats
 * Get available export formats and their options
 */
router.get('/formats', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        export_formats: {
            pdf: {
                description: 'Comprehensive PDF report with analysis and recommendations',
                content_type: 'application/pdf',
                options: {
                    title: 'Custom report title',
                    includeDetailedAnalysis: 'Include detailed site analysis (default: true)',
                    includeRecommendations: 'Include recommendations section (default: true)',
                    includeMaps: 'Include map visualizations (default: false - requires additional setup)'
                }
            },
            geojson: {
                description: 'Spatial data in GeoJSON format for GIS applications',
                content_type: 'application/geo+json',
                options: {
                    includeAllData: 'Include all analysis data in properties (default: true)',
                    maxFeatures: 'Maximum number of features to export (default: 1000)',
                    minScore: 'Minimum score threshold for inclusion (default: 0)'
                }
            },
            csv: {
                description: 'Tabular data in CSV format for spreadsheet analysis',
                content_type: 'text/csv',
                options: {
                    includeDetailedScores: 'Include individual factor scores (default: true)',
                    includeCoordinates: 'Include latitude/longitude columns (default: true)',
                    maxRecords: 'Maximum number of records to export (default: 1000)',
                    minScore: 'Minimum score threshold for inclusion (default: 0)'
                }
            }
        }
    });
}));

module.exports = router;
