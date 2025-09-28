#!/usr/bin/env python3
"""
GPT-5 Drive CLI - Enhanced command-line interface for GPT-5 Drive processing
Provides comprehensive control over Drive file processing with GPT-5 optimization
"""

import sys
import argparse
import json
import time
from pathlib import Path
from typing import List, Optional

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.config import PipelineConfig
from gpt5.drive_processor import GPT5DriveProcessor
from utils.logging import setup_logger


def create_parser() -> argparse.ArgumentParser:
    """Create comprehensive argument parser for GPT-5 Drive CLI"""
    parser = argparse.ArgumentParser(
        prog="knowledge-pipeline gpt5-drive",
        description="GPT-5 Enhanced Drive Processor - Advanced AI content processing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all unprocessed files
  knowledge-pipeline gpt5-drive --all

  # Process specific files
  knowledge-pipeline gpt5-drive --file-ids "1a2b3c,4d5e6f,7g8h9i"

  # Preview processing (dry run)
  knowledge-pipeline gpt5-drive --all --dry-run

  # Process files with specific Notion status
  knowledge-pipeline gpt5-drive --status-filter "pending"

  # Force reprocess all files
  knowledge-pipeline gpt5-drive --all --force

  # Process with custom batch size
  knowledge-pipeline gpt5-drive --all --batch-size 10

  # Get status summary
  knowledge-pipeline gpt5-drive --status

Features:
  ✅ GPT-5 optimized processing with high reasoning
  ✅ Quality scores 9.0+ with <20s processing time
  ✅ Notion-optimized formatting (≤12 blocks)
  ✅ Progress tracking and batch processing
  ✅ Status filtering and force reprocessing
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
        help="Comma-separated Drive file IDs to process (e.g., '1a2b3c,4d5e6f')"
    )
    operation_group.add_argument(
        "--status",
        action="store_true",
        help="Show processor status and statistics"
    )

    # Filtering options
    filter_group = parser.add_argument_group("Filtering Options")
    filter_group.add_argument(
        "--status-filter",
        choices=["pending", "processed", "failed", "all"],
        default="pending",
        help="Filter files by Notion processing status (default: pending)"
    )

    # Processing options
    processing_group = parser.add_argument_group("Processing Options")
    processing_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview processing without making changes"
    )
    processing_group.add_argument(
        "--force",
        action="store_true",
        help="Force reprocess files even if already processed"
    )
    processing_group.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="Number of files to process in each batch (default: 5)"
    )

    # Output options
    output_group = parser.add_argument_group("Output Options")
    output_group.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging output"
    )
    output_group.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress non-essential output"
    )
    output_group.add_argument(
        "--output-format",
        choices=["text", "json"],
        default="text",
        help="Output format for results (default: text)"
    )
    output_group.add_argument(
        "--save-results",
        type=str,
        help="Save detailed results to specified file path"
    )

    return parser


def validate_args(args: argparse.Namespace) -> bool:
    """Validate command line arguments"""
    if args.file_ids:
        # Validate file IDs format
        file_ids = args.file_ids.split(',')
        if not all(file_id.strip() for file_id in file_ids):
            print("Error: Invalid file IDs format. Use comma-separated values.")
            return False

        if len(file_ids) > 100:
            print("Error: Too many file IDs specified (max 100).")
            return False

    if args.batch_size < 1 or args.batch_size > 50:
        print("Error: Batch size must be between 1 and 50.")
        return False

    if args.verbose and args.quiet:
        print("Error: Cannot use both --verbose and --quiet options.")
        return False

    return True


def setup_logging_level(verbose: bool, quiet: bool):
    """Configure logging level based on options"""
    import logging

    if quiet:
        logging.getLogger().setLevel(logging.WARNING)
    elif verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.INFO)


def format_results(results: dict, format_type: str) -> str:
    """Format results for output"""
    if format_type == "json":
        return json.dumps(results, indent=2, default=str)

    # Text format
    output = []

    if results.get("success"):
        stats = results.get("stats")
        if stats:
            output.append("📊 PROCESSING SUMMARY")
            output.append("=" * 50)
            output.append(f"Total Files: {stats.total_files}")
            output.append(f"Processed: {stats.processed_files}")
            output.append(f"Skipped: {stats.skipped_files}")
            output.append(f"Failed: {stats.failed_files}")
            if stats.avg_quality_score > 0:
                output.append(f"Avg Quality Score: {stats.avg_quality_score:.1f}/10")
            if stats.avg_processing_time > 0:
                output.append(f"Avg Processing Time: {stats.avg_processing_time:.1f}s")
            output.append(f"Total Time: {stats.total_time:.1f}s")

        individual_results = results.get("results", [])
        if individual_results:
            output.append("\n📄 FILE RESULTS")
            output.append("=" * 50)
            for result in individual_results:
                status = result.get("status", "unknown")
                name = result.get("file_name", "Unknown")
                if status == "success":
                    quality = result.get("quality_score", 0)
                    time_taken = result.get("processing_time", 0)
                    output.append(f"✅ {name}: Quality {quality:.1f}/10, {time_taken:.1f}s")
                elif status == "skipped":
                    reason = result.get("reason", "unknown")
                    output.append(f"⏭️  {name}: Skipped ({reason})")
                elif status == "error":
                    error = result.get("error", "unknown error")
                    output.append(f"❌ {name}: Failed ({error})")
    else:
        output.append(f"❌ Processing failed: {results.get('message', 'Unknown error')}")

    return "\n".join(output)


def display_status(processor: GPT5DriveProcessor, format_type: str):
    """Display processor status"""
    status = processor.get_status_summary()

    if format_type == "json":
        print(json.dumps(status, indent=2, default=str))
    else:
        print("🚀 GPT-5 DRIVE PROCESSOR STATUS")
        print("=" * 50)
        print(f"Status: {status['processor_status']}")
        print(f"GPT-5 Optimization: {'✅ Enabled' if status['gpt5_optimization'] else '❌ Disabled'}")
        print(f"Mode: {'🔍 Dry Run' if status['dry_run_mode'] else '🔄 Live Processing'}")

        stats = status['statistics']
        print(f"\n📊 Statistics:")
        print(f"  Total Files Processed: {stats['total_files']}")
        print(f"  Successful: {stats['processed_files']}")
        print(f"  Skipped: {stats['skipped_files']}")
        print(f"  Failed: {stats['failed_files']}")

        if stats['avg_quality_score'] > 0:
            print(f"  Average Quality Score: {stats['avg_quality_score']:.1f}/10")
        if stats['avg_processing_time'] > 0:
            print(f"  Average Processing Time: {stats['avg_processing_time']:.1f}s")


def main():
    """Main CLI entry point"""
    # Parse arguments
    parser = create_parser()
    args = parser.parse_args()

    # Validate arguments
    if not validate_args(args):
        sys.exit(1)

    # Setup logging
    setup_logging_level(args.verbose, args.quiet)
    logger = setup_logger(__name__)

    try:
        # Load configuration
        config = PipelineConfig.from_env()
        logger.info("Configuration loaded successfully")

        # Initialize processor
        processor = GPT5DriveProcessor(config)

        # Ensure all required database properties exist
        if not args.dry_run:
            logger.info("Ensuring Notion database properties exist...")
            processor._ensure_database_properties()
            if not args.quiet:
                print("✅ Database properties verified/created")

        if args.dry_run and not args.quiet:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()

        # Handle status request
        if args.status:
            display_status(processor, args.output_format)
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

        # Format and display results
        if not args.quiet:
            print()
            formatted_results = format_results(results, args.output_format)
            print(formatted_results)

        # Save results if requested
        if args.save_results:
            with open(args.save_results, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            if not args.quiet:
                print(f"\n💾 Results saved to: {args.save_results}")

        # Exit with appropriate code
        if results.get("success"):
            if not args.quiet:
                total_time = time.time() - start_time
                print(f"\n✅ Processing completed in {total_time:.1f}s")
            sys.exit(0)
        else:
            if not args.quiet:
                print(f"\n❌ Processing failed")
            sys.exit(1)

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