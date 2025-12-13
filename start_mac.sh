#!/bin/bash

# PromptForge Server Startup Script (Mac/Linux)
# This script will automatically set up and run the PromptForge server

echo "🎨 PromptForge - Starting up..."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed."
    echo "Please install Python 3 from https://www.python.org/downloads/"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to create virtual environment."
        echo "Please make sure python3-venv is installed."
        exit 1
    fi
    
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo ""
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# --- Smart requirements installer ---
REQ_HASH_FILE="venv/.requirements_hash"

# Compute current hash of requirements.txt
CURRENT_HASH=$(sha256sum requirements.txt | awk '{ print $1 }')

NEED_INSTALL=true

# Check if previous hash exists and matches
if [ -f "$REQ_HASH_FILE" ]; then
    OLD_HASH=$(cat $REQ_HASH_FILE)
    if [ "$CURRENT_HASH" = "$OLD_HASH" ]; then
        NEED_INSTALL=false
    fi
fi

if [ "$NEED_INSTALL" = true ]; then
    echo ""
    echo "📥 Installing or updating dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt

    # Save the new hash
    echo "$CURRENT_HASH" > $REQ_HASH_FILE

    echo "✓ Dependencies installed/updated"
else
    echo "✓ Requirements: No changes detected"
fi
# --- End smart installer ---

# Start the Flask server
echo ""
echo "🚀 Starting PromptForge server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PromptForge is running!"
echo "  Open your browser and go to:"
echo ""
echo "    http://localhost:5000"
echo ""
echo "  Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

python app.py
