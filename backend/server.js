#!/usr/bin/env node
/**
 * Server entry point for SGS API
 * Starts the Express application with proper environment setup
 */

const app = require('./src/app');
const { testConnection, closePool } = require('./utils/database');

async function startServer() {
    try {
        // Test database connection on startup
        console.log('🔍 Testing database connection...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ Database connection failed. Server not started.');
            process.exit(1);
        }

        console.log('✅ Database connection successful');
        console.log('🚀 SGS API server is ready!');
        
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Graceful shutdown initiated...');
    
    try {
        await closePool();
        console.log('✅ Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Graceful shutdown initiated...');
    
    try {
        await closePool();
        console.log('✅ Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

// Start the server
startServer();
