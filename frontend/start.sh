#!/bin/bash

# Satellite Ground Station Frontend Startup Script

echo "🛰️  Starting Satellite Ground Station Location Optimizer Frontend"
echo "================================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set environment variables if .env doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating environment configuration..."
    cat > .env << EOF
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_MAP_CENTER_LAT=-25.2744
REACT_APP_MAP_CENTER_LNG=133.7751
REACT_APP_MAP_DEFAULT_ZOOM=6
EOF
fi

echo "🚀 Starting development server..."
echo "Frontend will be available at: http://localhost:3000"
echo "Make sure the backend API is running on port 3001"
echo ""

npm start
