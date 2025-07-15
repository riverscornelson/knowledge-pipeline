#!/usr/bin/env python3
"""
Main pipeline runner for the knowledge pipeline.
"""
import sys
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester
from src.utils.logging import setup_logger


def main():
    """Run the knowledge pipeline."""
    parser = argparse.ArgumentParser(description="Knowledge Pipeline Runner")
    parser.add_argument(
        "--source",
        choices=["all", "drive", "gmail", "firecrawl"],
        default="all",
        help="Which sources to process"
    )
    parser.add_argument(
        "--skip-enrichment",
        action="store_true",
        help="Skip AI enrichment phase"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making changes"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logger("pipeline")
    logger.info("Starting knowledge pipeline")
    
    try:
        # Load configuration
        config = PipelineConfig.from_env()
        logger.info("Configuration loaded successfully")
        
        # Initialize Notion client
        notion_client = NotionClient(config.notion)
        
        # Run ingestion based on source
        if args.source in ["all", "drive"]:
            logger.info("Starting Drive ingestion")
            drive_ingester = DriveIngester(config, notion_client)
            
            if not args.dry_run:
                stats = drive_ingester.ingest()
                logger.info(f"Drive ingestion complete: {stats}")
            else:
                logger.info("Dry run - skipping actual ingestion")
        
        # Secondary sources (lower priority)
        if args.source in ["all", "gmail"]:
            logger.info("Starting Gmail capture (secondary source)")
            from src.secondary_sources.gmail.capture import GmailCapture
            gmail_capture = GmailCapture(config, notion_client)
            
            if not args.dry_run:
                stats = gmail_capture.capture_emails()
                logger.info(f"Gmail capture complete: {stats}")
            else:
                logger.info("Dry run - skipping Gmail capture")
        
        if args.source in ["all", "firecrawl"]:
            logger.info("Starting Firecrawl capture (secondary source)")
            from src.secondary_sources.firecrawl.capture import FirecrawlCapture
            firecrawl_capture = FirecrawlCapture(config, notion_client)
            
            if not args.dry_run:
                stats = firecrawl_capture.capture_websites()
                logger.info(f"Firecrawl capture complete: {stats}")
            else:
                logger.info("Dry run - skipping Firecrawl capture")
        
        # Run enrichment unless skipped
        if not args.skip_enrichment and not args.dry_run:
            logger.info("Starting enrichment phase")
            from src.enrichment.pipeline_processor import PipelineProcessor
            enrichment_processor = PipelineProcessor(config, notion_client)
            
            stats = enrichment_processor.process_batch()
            logger.info(f"Enrichment complete: {stats}")
        
        logger.info("Pipeline complete")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()