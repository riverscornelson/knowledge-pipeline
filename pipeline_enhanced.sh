#!/bin/bash
# Enhanced Knowledge Pipeline with Parallel Processing Support
# Migration-safe with gradual rollout capabilities

set -e

# Configuration
ENABLE_PARALLEL=${ENABLE_PARALLEL:-false}
USE_ENHANCED=${USE_ENHANCED:-true}
LOG_DIR=${LOG_DIR:-logs}

# Create logs directory
mkdir -p "$LOG_DIR"

echo "🚀 Starting Enhanced Knowledge Pipeline"
echo "   Parallel processing: $ENABLE_PARALLEL"
echo "   Enhanced logging: $USE_ENHANCED"
echo "   Log directory: $LOG_DIR"

# Step 1: Ingest Google Drive PDFs
echo "📄 Step 1: Ingesting Google Drive PDFs..."
python3 ingest_drive.py

# Step 2: Capture RSS feeds
echo "📡 Step 2: Capturing RSS feeds..."
python3 capture_rss.py

# Step 3: Capture websites (Firecrawl)
echo "🌐 Step 3: Capturing websites..."
python3 capture_websites.py

# Step 4: Capture Gmail emails
echo "📧 Step 4: Capturing Gmail emails..."
python3 capture_emails.py

# Step 5: Enrich PDFs
echo "📊 Step 5: Enriching PDFs..."
if [ "$USE_ENHANCED" = "true" ]; then
    echo "   Using enhanced PDF enrichment with logging"
    python3 enrich_enhanced.py
else
    echo "   Using original PDF enrichment"
    python3 enrich.py
fi

# Step 6: Enrich RSS articles & websites
echo "📝 Step 6: Enriching RSS articles & websites..."
if [ "$USE_ENHANCED" = "true" ]; then
    echo "   Using resilient RSS enrichment with improved error handling"
    if [ "$ENABLE_PARALLEL" = "true" ]; then
        echo "   🚀 Parallel processing enabled (experimental)"
        python3 enrich_rss_enhanced.py --parallel || {
            echo "   ⚠️  Parallel processing failed, falling back to resilient sequential"
            python3 enrich_rss_resilient.py
        }
    else
        echo "   Sequential processing (resilient)"
        python3 enrich_rss_resilient.py
    fi
else
    echo "   Using original RSS enrichment"
    python3 enrich_rss.py
fi

echo "✅ Enhanced Knowledge Pipeline completed!"
echo "📊 Check $LOG_DIR/pipeline.jsonl for detailed logs"
