/**
 * Main Express Application for SGS (Satellite Ground Station) API
 * Provides RESTful endpoints for satellite ground station location optimization
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Route imports
const datasetRoutes = require('../routes/datasets');
const infrastructureRoutes = require('../routes/infrastructure');
const analysisRoutes = require('../routes/analysis');
const sitesRoutes = require('../routes/sites');
const advancedRoutes = require('../routes/advanced');
const exportRoutes = require('../routes/exports');

// Middleware imports
const { errorHandler } = require('../middleware/errorHandler');
const dbMiddleware = require('../middleware/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection middleware
app.use(dbMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: req.dbPool ? 'connected' : 'disconnected'
    });
});

// API Routes
app.use('/api/datasets', datasetRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/advanced', advancedRoutes);
app.use('/api/exports', exportRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'SGS API - Satellite Ground Station Location Optimization',
        version: '1.0.0',
        endpoints: {
            datasets: '/api/datasets',
            infrastructure: '/api/infrastructure',
            analysis: '/api/analysis',
            sites: '/api/sites',
            advanced: '/api/advanced',
            exports: '/api/exports',
            health: '/health'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /api/datasets',
            'GET /api/infrastructure/mobile',
            'GET /api/infrastructure/nbn',
            'GET /api/analysis/sites',
            'POST /api/analysis/custom'
        ]
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 SGS API server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`🗄️  Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

module.exports = app;
