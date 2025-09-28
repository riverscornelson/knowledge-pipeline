#!/usr/bin/env python3
"""
GPT-5 Drive CLI Entry Point
Main CLI functionality for GPT-5 enhanced Drive processing
"""

import sys
import argparse
import json
import time
from pathlib import Path
from typing import List, Optional

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import PipelineConfig
from gpt5.drive_processor import GPT5DriveProcessor
from utils.logging import setup_logger


def create_parser() -> argparse.ArgumentParser:
    """Create comprehensive argument parser for GPT-5 Drive CLI"""
    parser = argparse.ArgumentParser(
        prog="knowledge-pipeline-gpt5-drive",
        description="GPT-5 Enhanced Drive Processor - Advanced AI content processing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all unprocessed files
  knowledge-pipeline-gpt5-drive --all

  # Process specific files
  knowledge-pipeline-gpt5-drive --file-ids "1a2b3c,4d5e6f,7g8h9i"

  # Preview processing (dry run)
  knowledge-pipeline-gpt5-drive --all --dry-run

  # Get status summary
  knowledge-pipeline-gpt5-drive --status

Features:
  ✅ GPT-5 optimized processing with high reasoning
  ✅ Quality scores 9.0+ with <20s processing time
  ✅ Notion-optimized formatting (≤12 blocks)
  ✅ Progress tracking and batch processing
  ✅ Dry run mode for safe preview
        """
    )

    # Main operation modes
    operation_group = parser.add_mutually_exclusive_group(required=True)
    operation_group.add_argument(
        "--all",
        action="store_true",
        help="Process all unprocessed files in Drive"
    )
    operation_group.add_argument(
        "--file-ids",
        type=str,
        help="Comma-separated Drive file IDs to process"
    )
    operation_group.add_argument(
        "--status",
        action="store_true",
        help="Show processor status and statistics"
    )

    # Processing options
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview processing without making changes"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force reprocess files even if already processed"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="Number of files to process in each batch (default: 5)"
    )

    # Output options
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging output"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress non-essential output"
    )

    return parser


def main():
    """Main CLI entry point"""
    # Parse arguments
    parser = create_parser()
    args = parser.parse_args()

    # Setup logging
    if args.quiet:
        import logging
        logging.getLogger().setLevel(logging.WARNING)
    elif args.verbose:
        import logging
        logging.getLogger().setLevel(logging.DEBUG)

    logger = setup_logger(__name__)

    try:
        # Load configuration
        config = PipelineConfig.from_env()
        logger.info("Configuration loaded successfully")

        # Initialize processor
        processor = GPT5DriveProcessor(config, dry_run=args.dry_run)

        if args.dry_run and not args.quiet:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()

        # Handle status request
        if args.status:
            status = processor.get_status_summary()
            print("🚀 GPT-5 DRIVE PROCESSOR STATUS")
            print("=" * 50)
            print(f"Status: {status['processor_status']}")
            print(f"GPT-5 Optimization: {'✅ Enabled' if status['gpt5_optimization'] else '❌ Disabled'}")
            print(f"Mode: {'🔍 Dry Run' if status['dry_run_mode'] else '🔄 Live Processing'}")
            return

        # Process files
        start_time = time.time()

        if args.all:
            if not args.quiet:
                print("🚀 Processing all unprocessed Drive files...")
            results = processor.process_all_unprocessed(
                batch_size=args.batch_size,
                force=args.force
            )
        elif args.file_ids:
            file_ids = [fid.strip() for fid in args.file_ids.split(',')]
            if not args.quiet:
                print(f"🎯 Processing {len(file_ids)} specific files...")
            results = processor.process_specific_files(
                file_ids=file_ids,
                batch_size=args.batch_size,
                force=args.force
            )

        # Display results
        if not args.quiet:
            print()
            if results.get("success"):
                stats = results.get("stats")
                if stats:
                    print("📊 PROCESSING SUMMARY")
                    print("=" * 50)
                    print(f"Total Files: {stats.total_files}")
                    print(f"Processed: {stats.processed_files}")
                    print(f"Skipped: {stats.skipped_files}")
                    print(f"Failed: {stats.failed_files}")
                    if stats.avg_quality_score > 0:
                        print(f"Avg Quality Score: {stats.avg_quality_score:.1f}/10")
                    if stats.avg_processing_time > 0:
                        print(f"Avg Processing Time: {stats.avg_processing_time:.1f}s")
                    print(f"Total Time: {stats.total_time:.1f}s")

                total_time = time.time() - start_time
                print(f"\n✅ Processing completed in {total_time:.1f}s")
            else:
                print(f"❌ Processing failed: {results.get('message', 'Unknown error')}")

        # Exit with appropriate code
        sys.exit(0 if results.get("success") else 1)

    except KeyboardInterrupt:
        logger.info("Processing interrupted by user")
        print("\n⏸️  Processing interrupted")
        sys.exit(130)
    except Exception as e:
        logger.error(f"CLI error: {str(e)}", exc_info=True)
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()