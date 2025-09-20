/**
 * Export Service
 * Provides PDF report generation, GeoJSON export, and CSV export capabilities
 * for satellite ground station analysis results
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate PDF report for ground station analysis
 * @param {Object} analysisData - Analysis results data
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDFReport(analysisData, options = {}) {
    try {
        const {
            title = 'Satellite Ground Station Site Analysis Report',
            includeDetailedAnalysis = true,
            includeRecommendations = true,
            includeMaps = false // Maps would require additional map tile integration
        } = options;

        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Add first page
        let page = pdfDoc.addPage([612, 792]); // US Letter size
        const { width, height } = page.getSize();
        let yPosition = height - 50;

        // Title page
        page.drawText(title, {
            x: 50,
            y: yPosition,
            size: 20,
            font: helveticaBold,
            color: rgb(0, 0.2, 0.6)
        });
        yPosition -= 30;

        page.drawText(`Generated: ${new Date().toLocaleString()}`, {
            x: 50,
            y: yPosition,
            size: 12,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5)
        });
        yPosition -= 40;

        // Executive Summary
        yPosition = await addSection(page, helveticaBold, helveticaFont, 'Executive Summary', yPosition);
        
        if (analysisData.analysis?.candidate_sites) {
            const sites = analysisData.analysis.candidate_sites;
            const topSite = sites[0];
            
            const summaryText = [
                `Analysis identified ${sites.length} candidate locations for satellite ground station deployment.`,
                `Top recommended site: ${topSite?.latitude?.toFixed(4)}, ${topSite?.longitude?.toFixed(4)} (Score: ${topSite?.total_score?.toFixed(3)})`,
                `Analysis area: ${analysisData.metadata?.analysis_area_km2?.toFixed(1)} km²`,
                `Grid resolution: ${analysisData.metadata?.grid_resolution_km?.toFixed(1)} km`
            ];
            
            yPosition = await addTextBlock(page, helveticaFont, summaryText, yPosition, width);
        }

        // Add new page for detailed analysis
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;

        // Site Rankings
        yPosition = await addSection(page, helveticaBold, helveticaFont, 'Recommended Sites', yPosition);
        
        if (analysisData.analysis?.candidate_sites) {
            const topSites = analysisData.analysis.candidate_sites.slice(0, 10); // Top 10 sites
            
            yPosition = await addSiteTable(page, helveticaFont, helveticaBold, topSites, yPosition, width);
        }

        // Detailed Analysis (if requested)
        if (includeDetailedAnalysis && analysisData.analysis?.candidate_sites?.[0]) {
            // Add new page for detailed analysis
            page = pdfDoc.addPage([612, 792]);
            yPosition = height - 50;
            
            yPosition = await addSection(page, helveticaBold, helveticaFont, 'Detailed Analysis - Top Site', yPosition);
            yPosition = await addDetailedSiteAnalysis(page, helveticaFont, helveticaBold, analysisData.analysis.candidate_sites[0], yPosition, width);
        }

        // Methodology
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
        
        yPosition = await addSection(page, helveticaBold, helveticaFont, 'Analysis Methodology', yPosition);
        
        const methodologyText = [
            'This analysis employs a multi-factor optimization approach to identify optimal satellite ground station locations.',
            '',
            'Key Factors Analyzed:',
            '• Backhaul Infrastructure Proximity - Distance to existing telecommunications infrastructure',
            '• Population Density - Market demand and service potential',
            '• Terrain Elevation - RF propagation advantages and satellite visibility',
            '• RF Interference - Potential interference from existing transmitters',
            '• Land Availability - Crown land availability and regulatory constraints',
            '• Satellite Pass Optimization - Orbital mechanics and coverage efficiency',
            '• Market Demand Analysis - Business case and service demand',
            '',
            'Data Sources:',
            '• Mobile carrier infrastructure data (Telstra, Optus, TPG)',
            '• NBN coverage information',
            '• ELVIS elevation data',
            '• ABS population statistics',
            '• Crown land registries',
            '• Kuiper constellation orbital parameters'
        ];
        
        yPosition = await addTextBlock(page, helveticaFont, methodologyText, yPosition, width);

        // Recommendations (if requested)
        if (includeRecommendations) {
            page = pdfDoc.addPage([612, 792]);
            yPosition = height - 50;
            
            yPosition = await addSection(page, helveticaBold, helveticaFont, 'Recommendations', yPosition);
            
            const recommendationText = [
                'Next Steps for Implementation:',
                '',
                '1. Site Verification',
                '   • Conduct physical site surveys of top-ranked locations',
                '   • Verify land ownership and availability',
                '   • Assess local terrain and access requirements',
                '',
                '2. Regulatory Approvals',
                '   • Engage with relevant state land management agencies',
                '   • Submit telecommunications facility applications',
                '   • Obtain environmental and heritage clearances',
                '',
                '3. Technical Validation',
                '   • Perform detailed RF propagation modeling',
                '   • Conduct line-of-sight surveys to backhaul points',
                '   • Validate satellite pass predictions with orbital data',
                '',
                '4. Business Case Development',
                '   • Analyze market demand in each service area',
                '   • Develop cost models for site development',
                '   • Assess revenue potential and ROI projections'
            ];
            
            yPosition = await addTextBlock(page, helveticaFont, recommendationText, yPosition, width);
        }

        // Generate PDF bytes
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);

    } catch (error) {
        console.error('Error generating PDF report:', error.message);
        throw error;
    }
}

/**
 * Add a section header to the PDF
 */
async function addSection(page, boldFont, regularFont, title, yPosition) {
    page.drawText(title, {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0.2, 0.6)
    });
    
    // Add underline
    page.drawLine({
        start: { x: 50, y: yPosition - 5 },
        end: { x: 300, y: yPosition - 5 },
        thickness: 1,
        color: rgb(0, 0.2, 0.6)
    });
    
    return yPosition - 30;
}

/**
 * Add a text block to the PDF
 */
async function addTextBlock(page, font, textLines, yPosition, pageWidth) {
    const lineHeight = 14;
    const maxWidth = pageWidth - 100;
    
    for (const line of textLines) {
        if (line === '') {
            yPosition -= lineHeight / 2;
            continue;
        }
        
        // Check if we need a new page
        if (yPosition < 50) {
            // Note: In a full implementation, we'd need to handle page breaks
            break;
        }
        
        page.drawText(line, {
            x: 50,
            y: yPosition,
            size: 11,
            font: font,
            color: rgb(0, 0, 0),
            maxWidth: maxWidth
        });
        
        yPosition -= lineHeight;
    }
    
    return yPosition - 10;
}

/**
 * Add a site ranking table to the PDF
 */
async function addSiteTable(page, font, boldFont, sites, yPosition, pageWidth) {
    const headers = ['Rank', 'Latitude', 'Longitude', 'Score', 'Key Strengths'];
    const colWidths = [40, 80, 80, 60, 250];
    let xPosition = 50;
    
    // Draw table headers
    for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i], {
            x: xPosition,
            y: yPosition,
            size: 10,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        xPosition += colWidths[i];
    }
    
    yPosition -= 20;
    
    // Draw table rows
    for (let i = 0; i < Math.min(sites.length, 8); i++) {
        const site = sites[i];
        xPosition = 50;
        
        const rowData = [
            (i + 1).toString(),
            site.latitude?.toFixed(4) || 'N/A',
            site.longitude?.toFixed(4) || 'N/A',
            site.total_score?.toFixed(3) || 'N/A',
            generateKeyStrengths(site)
        ];
        
        for (let j = 0; j < rowData.length; j++) {
            page.drawText(rowData[j], {
                x: xPosition,
                y: yPosition,
                size: 9,
                font: font,
                color: rgb(0, 0, 0),
                maxWidth: colWidths[j] - 5
            });
            xPosition += colWidths[j];
        }
        
        yPosition -= 15;
        
        if (yPosition < 50) break;
    }
    
    return yPosition - 20;
}

/**
 * Add detailed site analysis
 */
async function addDetailedSiteAnalysis(page, font, boldFont, site, yPosition, pageWidth) {
    const analysisText = [
        `Location: ${site.latitude?.toFixed(4)}, ${site.longitude?.toFixed(4)}`,
        `Overall Score: ${site.total_score?.toFixed(3)} / 1.000`,
        '',
        'Score Breakdown:'
    ];
    
    if (site.score_breakdown) {
        for (const [factor, score] of Object.entries(site.score_breakdown)) {
            const factorName = factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            analysisText.push(`  ${factorName}: ${score?.toFixed(3)} / 1.000`);
        }
    }
    
    analysisText.push('');
    analysisText.push('Analysis Summary:');
    if (site.reasoning) {
        // Split long reasoning into multiple lines
        const reasoningLines = site.reasoning.match(/.{1,80}(\s|$)/g) || [site.reasoning];
        analysisText.push(...reasoningLines.map(line => `  ${line.trim()}`));
    }
    
    if (site.detailed_analysis?.satellite_analysis?.pass_metrics) {
        const satMetrics = site.detailed_analysis.satellite_analysis.pass_metrics;
        analysisText.push('');
        analysisText.push('Satellite Coverage Metrics:');
        analysisText.push(`  Daily Passes: ${satMetrics.total_daily_passes}`);
        analysisText.push(`  Average Pass Duration: ${satMetrics.avg_pass_duration_minutes} minutes`);
        analysisText.push(`  Maximum Elevation Angle: ${satMetrics.max_elevation_angle}°`);
        analysisText.push(`  Coverage Efficiency: ${(satMetrics.coverage_efficiency * 100).toFixed(1)}%`);
    }
    
    if (site.detailed_analysis?.market_analysis) {
        const marketAnalysis = site.detailed_analysis.market_analysis;
        analysisText.push('');
        analysisText.push('Market Analysis:');
        analysisText.push(`  Population Density: ${marketAnalysis.population_density?.toFixed(1)} people/km²`);
        analysisText.push(`  Estimated Service Area Population: ${marketAnalysis.estimated_population?.toLocaleString()}`);
        analysisText.push(`  Market Demand Score: ${marketAnalysis.overall_demand_score?.toFixed(3)}`);
    }
    
    return await addTextBlock(page, font, analysisText, yPosition, pageWidth);
}

/**
 * Generate key strengths summary for a site
 */
function generateKeyStrengths(site) {
    const strengths = [];
    
    if (site.score_breakdown?.backhaul_proximity > 0.7) strengths.push('Good backhaul');
    if (site.score_breakdown?.elevation > 0.7) strengths.push('Optimal elevation');
    if (site.score_breakdown?.satellite_optimization > 0.7) strengths.push('Excellent coverage');
    if (site.score_breakdown?.market_demand > 0.7) strengths.push('High demand');
    if (site.score_breakdown?.land_availability > 0.8) strengths.push('Available land');
    
    return strengths.join(', ') || 'Multiple factors';
}

/**
 * Export analysis results to GeoJSON format
 * @param {Object} analysisData - Analysis results data
 * @param {Object} options - Export options
 * @returns {Object} GeoJSON FeatureCollection
 */
function exportToGeoJSON(analysisData, options = {}) {
    try {
        const {
            includeAllData = true,
            maxFeatures = 1000,
            minScore = 0
        } = options;

        let sites = analysisData.analysis?.candidate_sites || [];
        
        // Filter and limit sites
        sites = sites
            .filter(site => site.total_score >= minScore)
            .slice(0, maxFeatures);

        const features = sites.map(site => {
            const properties = {
                id: site.id,
                total_score: site.total_score,
                latitude: site.latitude,
                longitude: site.longitude
            };

            if (includeAllData) {
                properties.score_breakdown = site.score_breakdown;
                properties.reasoning = site.reasoning;
                properties.weights_used = site.weights_used;
                
                if (site.detailed_analysis) {
                    properties.terrain_elevation = site.detailed_analysis.terrain_elevation;
                    properties.satellite_analysis = site.detailed_analysis.satellite_analysis;
                    properties.market_analysis = site.detailed_analysis.market_analysis;
                }
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [site.longitude, site.latitude]
                },
                properties: properties
            };
        });

        return {
            type: 'FeatureCollection',
            metadata: {
                generated: new Date().toISOString(),
                total_features: features.length,
                analysis_parameters: analysisData.analysis?.analysis_parameters,
                bbox_analyzed: analysisData.analysis?.bbox_analyzed
            },
            features: features
        };

    } catch (error) {
        console.error('Error exporting to GeoJSON:', error.message);
        throw error;
    }
}

/**
 * Export analysis results to CSV format
 * @param {Object} analysisData - Analysis results data
 * @param {Object} options - Export options
 * @returns {string} CSV data
 */
function exportToCSV(analysisData, options = {}) {
    try {
        const {
            includeDetailedScores = true,
            includeCoordinates = true,
            maxRecords = 1000,
            minScore = 0
        } = options;

        let sites = analysisData.analysis?.candidate_sites || [];
        
        // Filter and limit sites
        sites = sites
            .filter(site => site.total_score >= minScore)
            .slice(0, maxRecords);

        // Define CSV headers
        const headers = ['Rank', 'Site_ID', 'Total_Score'];
        
        if (includeCoordinates) {
            headers.push('Latitude', 'Longitude');
        }
        
        if (includeDetailedScores) {
            headers.push(
                'Backhaul_Proximity',
                'Population_Proximity', 
                'Elevation_Score',
                'RF_Interference',
                'Land_Availability',
                'Satellite_Optimization',
                'Market_Demand'
            );
        }
        
        headers.push('Reasoning_Summary');

        // Build CSV content
        const csvLines = [headers.join(',')];
        
        sites.forEach((site, index) => {
            const row = [
                index + 1,
                `"${site.id || 'N/A'}"`,
                site.total_score?.toFixed(4) || '0.0000'
            ];
            
            if (includeCoordinates) {
                row.push(
                    site.latitude?.toFixed(6) || '0.000000',
                    site.longitude?.toFixed(6) || '0.000000'
                );
            }
            
            if (includeDetailedScores && site.score_breakdown) {
                row.push(
                    site.score_breakdown.backhaul_proximity?.toFixed(4) || '0.0000',
                    site.score_breakdown.population_proximity?.toFixed(4) || '0.0000',
                    site.score_breakdown.elevation?.toFixed(4) || '0.0000',
                    site.score_breakdown.rf_interference?.toFixed(4) || '0.0000',
                    site.score_breakdown.land_availability?.toFixed(4) || '0.0000',
                    site.score_breakdown.satellite_optimization?.toFixed(4) || '0.0000',
                    site.score_breakdown.market_demand?.toFixed(4) || '0.0000'
                );
            }
            
            // Clean and escape reasoning text
            const reasoning = site.reasoning || 'No reasoning available';
            const cleanReasoning = reasoning.replace(/"/g, '""').replace(/\n/g, ' ');
            row.push(`"${cleanReasoning}"`);
            
            csvLines.push(row.join(','));
        });

        return csvLines.join('\n');

    } catch (error) {
        console.error('Error exporting to CSV:', error.message);
        throw error;
    }
}

/**
 * Save export data to file
 * @param {Buffer|string} data - Data to save
 * @param {string} filename - Output filename
 * @param {string} outputDir - Output directory (optional)
 * @returns {Promise<string>} Full file path
 */
async function saveExportFile(data, filename, outputDir = './exports') {
    try {
        // Ensure export directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        const fullPath = path.join(outputDir, filename);
        await fs.writeFile(fullPath, data);
        
        console.log(`Export saved to: ${fullPath}`);
        return fullPath;
        
    } catch (error) {
        console.error('Error saving export file:', error.message);
        throw error;
    }
}

module.exports = {
    generatePDFReport,
    exportToGeoJSON,
    exportToCSV,
    saveExportFile
};
