#!/usr/bin/env node
/**
 * PostgreSQL Database Connectivity Test Script (Node.js)
 * Tests connection to PostgreSQL database with PostGIS extension
 */

const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
    // Default database configuration
    // These can be overridden by environment variables
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'sgs',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 1, // Maximum number of clients in the pool
        connectionTimeoutMillis: 5000, // Connection timeout
    };

    console.log('='.repeat(60));
    console.log('PostgreSQL Database Connectivity Test (Node.js)');
    console.log('='.repeat(60));
    console.log(`Testing connection to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    console.log(`User: ${dbConfig.user}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('-'.repeat(60));

    const pool = new Pool(dbConfig);
    let client;

    try {
        // Attempt to connect to the database
        console.log('1. Testing database connection...');
        client = await pool.connect();
        console.log('✅ Database connection successful!');

        // Test basic query
        console.log('\n2. Testing basic query...');
        const versionResult = await client.query('SELECT version();');
        console.log(`✅ PostgreSQL version: ${versionResult.rows[0].version}`);

        // Test PostGIS extension
        console.log('\n3. Testing PostGIS extension...');
        const postgisCheck = await client.query(`
            SELECT EXISTS(
                SELECT 1 FROM pg_extension WHERE extname = 'postgis'
            ) as postgis_installed;
        `);

        if (postgisCheck.rows[0].postgis_installed) {
            const postgisVersion = await client.query('SELECT PostGIS_Version();');
            console.log(`✅ PostGIS extension is installed: ${postgisVersion.rows[0].postgis_version}`);
        } else {
            console.log('⚠️  PostGIS extension is NOT installed');
            console.log('   Run: CREATE EXTENSION IF NOT EXISTS postgis;');
        }

        // Check for existing tables
        console.log('\n4. Checking existing tables...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        if (tablesResult.rows.length > 0) {
            console.log(`✅ Found ${tablesResult.rows.length} tables:`);
            tablesResult.rows.forEach(table => {
                console.log(`   - ${table.table_name}`);
            });
        } else {
            console.log('ℹ️  No tables found in public schema');
        }

        // Test spatial capabilities if PostGIS is available
        if (postgisCheck.rows[0].postgis_installed) {
            console.log('\n5. Testing spatial capabilities...');
            try {
                const spatialTest = await client.query(`
                    SELECT ST_AsText(ST_Point(-122.4194, 37.7749)) as san_francisco_point;
                `);
                console.log(`✅ Spatial query successful: ${spatialTest.rows[0].san_francisco_point}`);
            } catch (error) {
                console.log(`⚠️  Spatial query failed: ${error.message}`);
            }
        }

        // Test database permissions
        console.log('\n6. Testing database permissions...');
        const permissionsResult = await client.query(`
            SELECT 
                has_database_privilege(current_user, current_database(), 'CREATE') as can_create,
                has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
                has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public;
        `);
        const perms = permissionsResult.rows[0];
        console.log(`✅ CREATE permission: ${perms.can_create}`);
        console.log(`✅ CONNECT permission: ${perms.can_connect}`);
        console.log(`✅ CREATE in public schema: ${perms.can_create_in_public}`);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Database connectivity test PASSED!');
        console.log('The database is ready for geospatial operations.');
        console.log('='.repeat(60));

        return true;

    } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}`);
        console.log('\nTroubleshooting steps:');
        console.log('1. Ensure PostgreSQL is running');
        console.log('2. Check database credentials');
        console.log('3. Verify database exists');
        console.log('4. Check network connectivity');
        console.log('5. Install required npm packages: npm install pg dotenv');
        return false;

    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        console.log('\n✅ Database connection pool closed.');
    }
}

function printEnvironmentHelp() {
    console.log('\nEnvironment Variables (optional):');
    console.log('DB_HOST     - Database host (default: localhost)');
    console.log('DB_PORT     - Database port (default: 5432)');
    console.log('DB_NAME     - Database name (default: sgs)');
    console.log('DB_USER     - Database user (default: postgres)');
    console.log('DB_PASSWORD - Database password (default: password)');
    console.log('\nExample:');
    console.log('Create a .env file with:');
    console.log('DB_HOST=localhost');
    console.log('DB_NAME=sgs');
    console.log('DB_USER=your_username');
    console.log('DB_PASSWORD=your_password');
    console.log('\nThen run: node test_db_connection.js');
}

// Main execution
if (process.argv.includes('-h') || process.argv.includes('--help')) {
    printEnvironmentHelp();
    process.exit(0);
}

testDatabaseConnection()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
