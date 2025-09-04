#!/bin/bash

# Seren Capture Backend Startup Script
# This ensures we're always in the correct directory

echo "🚀 Seren Capture Backend Startup"
echo "================================"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change to the backend directory
cd "$SCRIPT_DIR"

echo "🖥️  Current directory: $(pwd)"
echo "📁 Project: $(basename $(pwd))"

# Verify we're in the right place
if [ ! -f "index.js" ]; then
    echo "❌ Error: Not in the backend directory!"
    echo "   Expected to find index.js file"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in a valid Node.js project directory!"
    echo "   Expected to find package.json file"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found. Please install Node.js"
    exit 1
fi

# Check if .env exists, if not run setup
if [ ! -f ".env" ]; then
    echo "⚙️  No .env file found. Running setup..."
    npm run setup
fi

echo "✅ All checks passed!"
echo "🔄 Starting backend server..."
echo ""

# Kill any existing process on port 3000
echo "🧹 Cleaning up any existing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the backend server
npm start
