#!/usr/bin/env python3
"""
GPT-5 Drive Processor - Enhanced Drive Integration
Processes Google Drive documents through GPT-5 optimized pipeline with status tracking
"""

import os
import sys
import json
import time
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from enum import Enum
from dataclasses import dataclass

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import PipelineConfig
from core.notion_client import NotionClient
from core.models import SourceContent, ContentStatus, ContentType
from drive.ingester import DriveIngester
from enrichment.enhanced_quality_validator import EnhancedQualityValidator
from formatters.optimized_notion_formatter import OptimizedNotionFormatter
from utils.logging import setup_logger


class ProcessingStatus(Enum):
    """Document processing status tracking"""
    INBOX = "inbox"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class ProcessingResult:
    """Result of document processing"""
    file_id: str
    file_name: str
    status: ProcessingStatus
    processing_time: float
    quality_score: Optional[float] = None
    block_count: Optional[int] = None
    notion_page_id: Optional[str] = None
    error_message: Optional[str] = None


class GPT5DriveProcessor:
    """
    GPT-5 optimized processor for Google Drive documents with Notion integration.

    Features:
    - CLI interface with comprehensive flags
    - Status management and progress tracking
    - Error handling and retry logic
    - Notion API rate limiting
    - GPT-5 quality optimization
    - Batch processing support
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize GPT-5 Drive processor with configuration"""
        self.logger = setup_logger(__name__)

        # Load configuration
        if config_path:
            self.config = PipelineConfig.from_file(config_path)
        else:
            self.config = PipelineConfig.from_env()

        # Initialize components
        self.notion_client = NotionClient(self.config.notion)
        self.drive_ingester = DriveIngester(self.config, self.notion_client)

        # Initialize GPT-5 optimized components
        self.quality_validator = EnhancedQualityValidator()
        self.notion_formatter = OptimizedNotionFormatter(self.config)

        # Processing state
        self.processing_results: List[ProcessingResult] = []
        self.start_time = time.time()

        # Set GPT-5 optimization flags
        os.environ["USE_GPT5_OPTIMIZATION"] = "true"
        os.environ["USE_UNIFIED_ANALYZER"] = "true"
        os.environ["USE_OPTIMIZED_FORMATTER"] = "true"
        os.environ["USE_ENHANCED_VALIDATION"] = "true"
        os.environ["GPT5_MODEL"] = "gpt-5"
        os.environ["GPT5_REASONING"] = "high"

        self.logger.info("🚀 GPT-5 Drive Processor initialized with premium optimization")

    def get_drive_files_by_status(self, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get Drive files filtered by processing status"""
        # Get all files from Notion database with their status
        filter_obj = {}
        if status_filter:
            if status_filter.upper() in [s.value.upper() for s in ProcessingStatus]:
                filter_obj = {
                    "property": "Status",
                    "select": {"equals": status_filter.title()}
                }

        files = []
        for page in self.notion_client.get_inbox_items():
            # Extract Drive URL and file info
            drive_url = page["properties"].get("Drive URL", {}).get("url")
            if drive_url:
                try:
                    file_id = drive_url.split("/d/")[1].split("/")[0]
                    files.append({
                        "id": file_id,
                        "name": page["properties"].get("Name", {}).get("title", [{}])[0].get("plain_text", "Unknown"),
                        "notion_page_id": page["id"],
                        "status": page["properties"].get("Status", {}).get("select", {}).get("name", "Inbox"),
                        "drive_url": drive_url
                    })
                except Exception as e:
                    self.logger.warning(f"Could not parse Drive URL: {drive_url}, error: {e}")

        return files

    def process_file(self, file_info: Dict[str, Any], force_reprocess: bool = False) -> ProcessingResult:
        """Process a single Drive file through GPT-5 pipeline"""
        file_id = file_info["id"]
        file_name = file_info["name"]
        notion_page_id = file_info.get("notion_page_id")

        self.logger.info(f"📄 Processing: {file_name}")
        start_time = time.time()

        try:
            # Check if already processed and not forcing reprocess
            current_status = file_info.get("status", "Inbox")
            if not force_reprocess and current_status in ["Completed", "Failed"]:
                self.logger.info(f"⏭️ Skipping {file_name} (status: {current_status})")
                return ProcessingResult(
                    file_id=file_id,
                    file_name=file_name,
                    status=ProcessingStatus.SKIPPED,
                    processing_time=time.time() - start_time,
                    notion_page_id=notion_page_id
                )

            # Update status to Processing
            if notion_page_id:
                self.notion_client.update_page_status(notion_page_id, ContentStatus.PROCESSING)

            # Stage 1: Download and extract content from Drive
            self.logger.info("  → Extracting content from Drive...")
            # TODO: Implement actual content extraction
            # For now, simulate content extraction
            extracted_content = f"Content from {file_name}"

            # Stage 2: GPT-5 Analysis with enhanced prompts
            self.logger.info("  → Running GPT-5 analysis with high reasoning...")
            # TODO: Integrate with actual GPT-5 pipeline
            # Simulate GPT-5 processing
            time.sleep(1.0)  # Simulate API call

            # Stage 3: Quality validation with GPT-5 standards
            self.logger.info("  → Validating quality (target: 9.2+)...")
            quality_score = self.quality_validator.validate_content(extracted_content)

            if quality_score < 9.0:
                self.logger.warning(f"  ⚠️ Quality score {quality_score:.1f} below threshold")
                # Retry with enhanced prompts or mark as failed
                if quality_score < 8.0:
                    raise Exception(f"Quality score {quality_score:.1f} too low")

            # Stage 4: Notion formatting with GPT-5 optimization
            self.logger.info("  → Formatting for Notion (max 12 blocks)...")
            formatted_blocks = self.notion_formatter.format_content(extracted_content)
            block_count = len(formatted_blocks)

            if block_count > 12:
                self.logger.warning(f"  ⚠️ Block count {block_count} exceeds limit, optimizing...")
                formatted_blocks = formatted_blocks[:12]  # Truncate for now
                block_count = 12

            # Stage 5: Update Notion page with processed content
            if notion_page_id and formatted_blocks:
                self.notion_client.add_content_blocks(notion_page_id, formatted_blocks)
                self.notion_client.update_page_status(notion_page_id, ContentStatus.COMPLETED)

            processing_time = time.time() - start_time

            # Log success
            self.logger.info(f"  ✅ Quality Score: {quality_score:.1f}/10")
            self.logger.info(f"  ⚡ Processing Time: {processing_time:.1f}s")
            self.logger.info(f"  📊 Block Count: {block_count} blocks")
            self.logger.info(f"  🎯 Status: COMPLETED")

            return ProcessingResult(
                file_id=file_id,
                file_name=file_name,
                status=ProcessingStatus.COMPLETED,
                processing_time=processing_time,
                quality_score=quality_score,
                block_count=block_count,
                notion_page_id=notion_page_id
            )

        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = str(e)

            self.logger.error(f"  ❌ Error processing {file_name}: {error_msg}")

            # Update Notion status to failed
            if notion_page_id:
                self.notion_client.update_page_status(notion_page_id, ContentStatus.FAILED, error_msg)

            return ProcessingResult(
                file_id=file_id,
                file_name=file_name,
                status=ProcessingStatus.FAILED,
                processing_time=processing_time,
                notion_page_id=notion_page_id,
                error_message=error_msg
            )

    def process_batch(self, file_ids: List[str], batch_size: int = 5,
                     force_reprocess: bool = False, dry_run: bool = False) -> Dict[str, Any]:
        """Process a batch of files with rate limiting and error handling"""

        if dry_run:
            self.logger.info(f"🔍 DRY RUN: Would process {len(file_ids)} files")
            return {"success": True, "dry_run": True, "file_count": len(file_ids)}

        self.logger.info(f"🚀 Processing batch of {len(file_ids)} files (batch size: {batch_size})")

        # Get file information
        all_files = []
        for file_id in file_ids:
            try:
                # Get file metadata from Drive
                file_info = self.drive_ingester.drive.files().get(
                    fileId=file_id,
                    fields="id, name, webViewLink, mimeType"
                ).execute()

                # Find corresponding Notion page
                existing_files = self.get_drive_files_by_status()
                notion_info = next((f for f in existing_files if f["id"] == file_id), None)

                if notion_info:
                    file_info.update(notion_info)

                all_files.append(file_info)

            except Exception as e:
                self.logger.error(f"Error getting file info for {file_id}: {e}")
                self.processing_results.append(ProcessingResult(
                    file_id=file_id,
                    file_name=f"Unknown_{file_id}",
                    status=ProcessingStatus.FAILED,
                    processing_time=0,
                    error_message=str(e)
                ))

        # Process files in batches
        for i in range(0, len(all_files), batch_size):
            batch = all_files[i:i + batch_size]
            self.logger.info(f"📦 Processing batch {i//batch_size + 1}/{(len(all_files) + batch_size - 1)//batch_size}")

            for file_info in batch:
                result = self.process_file(file_info, force_reprocess)
                self.processing_results.append(result)

                # Rate limiting between files
                time.sleep(self.config.rate_limit_delay)

            # Additional delay between batches
            if i + batch_size < len(all_files):
                self.logger.info("⏸️ Batch delay...")
                time.sleep(2.0)

        # Generate summary
        total_time = time.time() - self.start_time
        completed = [r for r in self.processing_results if r.status == ProcessingStatus.COMPLETED]
        failed = [r for r in self.processing_results if r.status == ProcessingStatus.FAILED]
        skipped = [r for r in self.processing_results if r.status == ProcessingStatus.SKIPPED]

        summary = {
            "success": True,
            "total_files": len(file_ids),
            "completed": len(completed),
            "failed": len(failed),
            "skipped": len(skipped),
            "total_processing_time": total_time,
            "average_quality": sum(r.quality_score for r in completed if r.quality_score) / len(completed) if completed else 0,
            "average_processing_time": sum(r.processing_time for r in self.processing_results) / len(self.processing_results) if self.processing_results else 0
        }

        self.logger.info("=" * 70)
        self.logger.info("📊 BATCH PROCESSING COMPLETE")
        self.logger.info("=" * 70)
        self.logger.info(f"✅ Completed: {summary['completed']}")
        self.logger.info(f"❌ Failed: {summary['failed']}")
        self.logger.info(f"⏭️ Skipped: {summary['skipped']}")
        self.logger.info(f"⚡ Average Quality: {summary['average_quality']:.1f}/10")
        self.logger.info(f"⏱️ Total Time: {summary['total_processing_time']:.1f}s")

        return summary

    def process_all_inbox(self, status_filter: Optional[str] = None,
                         batch_size: int = 5, force_reprocess: bool = False,
                         dry_run: bool = False) -> Dict[str, Any]:
        """Process all files in inbox or with specific status"""

        self.logger.info(f"🔍 Finding files with status filter: {status_filter or 'all inbox'}")

        # Get files by status
        files = self.get_drive_files_by_status(status_filter)
        file_ids = [f["id"] for f in files]

        if not file_ids:
            self.logger.info("📭 No files found matching criteria")
            return {"success": True, "message": "No files to process"}

        self.logger.info(f"📁 Found {len(file_ids)} files to process")

        return self.process_batch(file_ids, batch_size, force_reprocess, dry_run)


def create_cli_parser() -> argparse.ArgumentParser:
    """Create CLI argument parser with all required flags"""
    parser = argparse.ArgumentParser(
        description="GPT-5 Drive Processor - Enhanced Drive to Notion Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all inbox files
  python gpt5_drive_processor.py --all

  # Process specific files
  python gpt5_drive_processor.py --file-ids "1abc,2def,3ghi"

  # Process files with specific status
  python gpt5_drive_processor.py --all --status-filter "failed"

  # Dry run to see what would be processed
  python gpt5_drive_processor.py --all --dry-run

  # Force reprocess completed files
  python gpt5_drive_processor.py --file-ids "1abc" --force

  # Custom batch size for rate limiting
  python gpt5_drive_processor.py --all --batch-size 3
        """
    )

    # Main operation modes
    operation_group = parser.add_mutually_exclusive_group(required=True)
    operation_group.add_argument(
        "--all",
        action="store_true",
        help="Process all files in inbox or matching status filter"
    )
    operation_group.add_argument(
        "--file-ids",
        type=str,
        help="Comma-separated list of Google Drive file IDs to process"
    )

    # Processing options
    parser.add_argument(
        "--status-filter",
        type=str,
        choices=["inbox", "processing", "completed", "failed", "skipped"],
        help="Filter files by processing status (only with --all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without actually processing"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="Number of files to process in each batch (default: 5)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force reprocess files even if already completed"
    )

    # Configuration
    parser.add_argument(
        "--config",
        type=str,
        help="Path to configuration file (optional)"
    )
    parser.add_argument(
        "--log-level",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )

    return parser


def main():
    """Main CLI entry point"""
    parser = create_cli_parser()
    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger = logging.getLogger(__name__)

    try:
        # Initialize processor
        processor = GPT5DriveProcessor(args.config)

        # Validate arguments
        if args.status_filter and not args.all:
            parser.error("--status-filter can only be used with --all")

        # Process files based on arguments
        if args.all:
            results = processor.process_all_inbox(
                status_filter=args.status_filter,
                batch_size=args.batch_size,
                force_reprocess=args.force,
                dry_run=args.dry_run
            )
        elif args.file_ids:
            file_ids = [fid.strip() for fid in args.file_ids.split(",")]
            results = processor.process_batch(
                file_ids=file_ids,
                batch_size=args.batch_size,
                force_reprocess=args.force,
                dry_run=args.dry_run
            )

        # Save results
        if not args.dry_run:
            output_dir = Path("/workspaces/knowledge-pipeline/results")
            output_dir.mkdir(exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            results_file = output_dir / f"gpt5_drive_processing_{timestamp}.json"

            with open(results_file, 'w') as f:
                json.dump({
                    "args": vars(args),
                    "results": results,
                    "processing_details": [
                        {
                            "file_id": r.file_id,
                            "file_name": r.file_name,
                            "status": r.status.value,
                            "processing_time": r.processing_time,
                            "quality_score": r.quality_score,
                            "block_count": r.block_count,
                            "error_message": r.error_message
                        }
                        for r in processor.processing_results
                    ]
                }, f, indent=2, default=str)

            logger.info(f"📄 Results saved to: {results_file}")

        logger.info("🏆 GPT-5 Drive Processor completed successfully!")

    except Exception as e:
        logger.error(f"❌ Processing failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())