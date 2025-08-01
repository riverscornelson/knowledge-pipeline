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
from src.local_uploader.preprocessor import process_local_pdfs


def main():
    """Run the knowledge pipeline."""
    parser = argparse.ArgumentParser(description="Knowledge Pipeline Runner")
    parser.add_argument(
        "--source",
        choices=["drive"],
        default="drive",
        help="Source to process (currently only Google Drive supported)"
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
    parser.add_argument(
        "--process-local",
        action="store_true",
        help="Upload local PDFs to Drive before processing"
    )
    parser.add_argument(
        "--drive-file-ids",
        type=str,
        help="Comma-separated Drive file IDs to process"
    )
    parser.add_argument(
        "--process-specific-files",
        action="store_true",
        help="Only process specified files"
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
        
        # Process local PDFs if requested
        if args.process_local:
            logger.info("Starting local PDF upload preprocessing")
            if not args.dry_run:
                local_stats = process_local_pdfs(config, notion_client)
                logger.info(f"Uploaded {local_stats['uploaded']} new PDFs to Drive")
                logger.info(f"Local upload stats: {local_stats}")
            else:
                logger.info("Dry run - skipping local PDF upload")
        
        # Run Google Drive ingestion
        logger.info("Starting Drive ingestion")
        drive_ingester = DriveIngester(config, notion_client)
        
        if not args.dry_run:
            if args.process_specific_files and args.drive_file_ids:
                # Process only specific files
                file_ids = args.drive_file_ids.split(',')
                logger.info(f"Processing specific files: {file_ids}")
                stats = drive_ingester.process_specific_files(file_ids)
            else:
                # Regular ingestion
                stats = drive_ingester.ingest()
            logger.info(f"Drive ingestion complete: {stats}")
        else:
            logger.info("Dry run - skipping actual ingestion")
        
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