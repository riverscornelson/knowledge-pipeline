"""
GPT-5 Status Management Integration Example
Demonstrates how to integrate the status management system into the pipeline.
"""

import sys
import os
import asyncio
import time
from typing import List, Dict, Any

# Add project root to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from src.core.models import SourceContent, ContentStatus
from src.gpt5.status_manager import (
    StatusManager, ProcessingStage, with_status_tracking,
    get_status_manager
)
from src.gpt5.progress_reporter import CLIProgressHandler
from src.gpt5.error_recovery import (
    ErrorRecoveryManager, get_error_recovery_manager
)


class GPT5PipelineWithStatusManagement:
    """
    Example implementation showing how to integrate status management
    into the GPT-5 processing pipeline.
    """

    def __init__(self):
        self.status_manager = get_status_manager()
        self.error_recovery = get_error_recovery_manager(self.status_manager)
        self.progress_handler = CLIProgressHandler(self.status_manager)

    @with_status_tracking(ProcessingStage.CONTENT_EXTRACTION)
    def extract_content(self, content_id: str, source_content: SourceContent) -> Dict[str, Any]:
        """Extract content with status tracking."""
        # Simulate content extraction
        time.sleep(0.5)  # Simulate processing time

        # Example: Sometimes fail to test error recovery
        import random
        if random.random() < 0.1:  # 10% chance of failure
            raise Exception("Content extraction failed - simulated error")

        return {
            "raw_text": f"Extracted content for {content_id}",
            "metadata": {"length": 1500, "language": "en"}
        }

    @with_status_tracking(ProcessingStage.QUALITY_VALIDATION)
    def validate_quality(self, content_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Validate content quality with status tracking."""
        time.sleep(0.3)

        # Example validation
        quality_score = 0.85
        return {
            "quality_score": quality_score,
            "validation_passed": quality_score > 0.7,
            "issues": []
        }

    @with_status_tracking(ProcessingStage.ENRICHMENT)
    def enrich_content(self, content_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich content with GPT-5 processing."""
        time.sleep(1.0)  # Simulate AI processing

        # Wait for rate limits if necessary
        self.status_manager.wait_for_rate_limit(estimated_tokens=2000)

        # Record API usage
        self.status_manager.record_api_usage(tokens_used=1850)

        return {
            "summary": f"AI-generated summary for {content_id}",
            "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
            "ai_primitives": ["reasoning", "analysis"],
            "confidence_score": 0.92
        }

    @with_status_tracking(ProcessingStage.NOTION_FORMATTING)
    def format_for_notion(self, content_id: str, enriched_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format content for Notion upload."""
        time.sleep(0.2)

        # Simulate formatting
        blocks = [
            {"type": "heading_1", "content": "Summary"},
            {"type": "paragraph", "content": enriched_content["summary"]},
            {"type": "heading_2", "content": "Key Insights"},
            {"type": "bulleted_list", "content": enriched_content["key_insights"]}
        ]

        return blocks

    @with_status_tracking(ProcessingStage.NOTION_UPLOAD)
    def upload_to_notion(self, content_id: str, notion_blocks: List[Dict[str, Any]]) -> str:
        """Upload formatted content to Notion."""
        time.sleep(0.8)

        # Simulate occasional API errors
        import random
        if random.random() < 0.05:  # 5% chance of Notion API error
            raise Exception("Notion API rate limit exceeded")

        return f"notion_page_{content_id}"

    def process_single_item(self, source_content: SourceContent) -> bool:
        """Process a single content item through the full pipeline."""
        content_id = source_content.hash

        try:
            # Start processing
            self.status_manager.start_processing(
                content_id,
                metadata={
                    "title": source_content.title,
                    "content_type": source_content.content_type.value if source_content.content_type else None,
                    "started_at": time.time()
                }
            )

            # Step 1: Extract content
            extracted = self.extract_content(content_id, source_content)

            # Step 2: Validate quality
            validation = self.validate_quality(content_id, extracted)
            if not validation["validation_passed"]:
                raise Exception(f"Quality validation failed: {validation['issues']}")

            # Step 3: Enrich with GPT-5
            enriched = self.enrich_content(content_id, extracted)

            # Step 4: Format for Notion
            notion_blocks = self.format_for_notion(content_id, enriched)

            # Step 5: Upload to Notion
            notion_page_id = self.upload_to_notion(content_id, notion_blocks)

            # Mark as completed
            self.status_manager.mark_completed(
                content_id,
                metadata={
                    "notion_page_id": notion_page_id,
                    "completed_at": time.time(),
                    "blocks_count": len(notion_blocks)
                }
            )

            return True

        except Exception as e:
            # Error recovery will be handled by the decorators
            self.status_manager.mark_failed(
                content_id,
                metadata={"error": str(e), "failed_at": time.time()}
            )
            return False

    async def process_with_recovery(self, source_content: SourceContent) -> bool:
        """Process with advanced error recovery."""
        content_id = source_content.hash

        async def processing_function():
            return self.process_single_item(source_content)

        # Use error recovery wrapper
        recovery_decorator = self.error_recovery.with_error_recovery(ProcessingStage.INITIALIZATION)
        wrapped_function = recovery_decorator(lambda _: processing_function())

        try:
            await wrapped_function(None, content_id)
            return True
        except Exception as e:
            print(f"Failed to process {content_id} after all retries: {e}")
            return False

    def process_batch(self, source_contents: List[SourceContent]) -> Dict[str, Any]:
        """Process a batch of content items with full status management."""

        def batch_processing():
            results = {"successful": 0, "failed": 0, "total": len(source_contents)}

            for content in source_contents:
                success = self.process_single_item(content)
                if success:
                    results["successful"] += 1
                else:
                    results["failed"] += 1

            return results

        # Run with progress monitoring
        results = self.progress_handler.run_with_progress(
            batch_processing,
            total_items=len(source_contents),
            live_updates=True,
            update_interval=1.0
        )

        return results

    def get_processing_report(self) -> Dict[str, Any]:
        """Generate a comprehensive processing report."""
        return self.status_manager.get_progress_report()

    def cleanup_old_data(self, days_old: int = 30):
        """Clean up old processing records."""
        self.status_manager.cleanup_old_records(days_old)


def demo_status_management():
    """Demonstrate the status management system."""
    print("🚀 GPT-5 Status Management System Demo")
    print("=" * 50)

    # Create demo pipeline
    pipeline = GPT5PipelineWithStatusManagement()

    # Create sample content
    sample_contents = [
        SourceContent(
            title="Sample Document 1",
            status=ContentStatus.INBOX,
            hash="doc_001",
            content_type=None,
            raw_content="Sample content for processing..."
        ),
        SourceContent(
            title="Sample Document 2",
            status=ContentStatus.INBOX,
            hash="doc_002",
            content_type=None,
            raw_content="Another sample document..."
        ),
        SourceContent(
            title="Sample Document 3",
            status=ContentStatus.INBOX,
            hash="doc_003",
            content_type=None,
            raw_content="Third sample document..."
        )
    ]

    print(f"\n📋 Processing {len(sample_contents)} sample documents...")

    # Process the batch
    results = pipeline.process_batch(sample_contents)

    print(f"\n📊 Processing Results:")
    print(f"   ✅ Successful: {results['successful']}")
    print(f"   ❌ Failed: {results['failed']}")
    print(f"   📈 Success Rate: {results['successful']/results['total']*100:.1f}%")

    # Show detailed report
    print(f"\n📈 Detailed Processing Report:")
    report = pipeline.get_processing_report()
    for key, value in report.items():
        if isinstance(value, dict):
            print(f"   {key}:")
            for sub_key, sub_value in value.items():
                print(f"     {sub_key}: {sub_value}")
        else:
            print(f"   {key}: {value}")

    print("\n✅ Demo completed!")


if __name__ == "__main__":
    demo_status_management()