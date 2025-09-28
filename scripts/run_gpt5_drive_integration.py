#!/usr/bin/env python3
"""
GPT-5 Drive Integration Runner - Production CLI
Main entry point for processing Google Drive documents through GPT-5 pipeline
"""

import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from drive.gpt5_drive_processor import GPT5DriveProcessor, main

if __name__ == "__main__":
    # Setup enhanced logging for production
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('/workspaces/knowledge-pipeline/logs/gpt5_drive_integration.log', mode='a')
        ]
    )

    logger = logging.getLogger(__name__)
    logger.info("🚀 Starting GPT-5 Drive Integration - Production Mode")

    try:
        # Ensure logs directory exists
        Path('/workspaces/knowledge-pipeline/logs').mkdir(exist_ok=True)

        # Run the main CLI
        exit_code = main()
        sys.exit(exit_code)

    except Exception as e:
        logger.error(f"❌ Critical error in GPT-5 Drive Integration: {e}")
        sys.exit(1)