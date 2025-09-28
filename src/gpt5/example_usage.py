#!/usr/bin/env python3
"""
Example usage of GPT5DriveProcessor

This script demonstrates how to use the GPT5DriveProcessor to process
documents from Google Drive with GPT-5 optimization.
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import PipelineConfig
from core.models import ContentStatus
from gpt5.drive_processor import GPT5DriveProcessor


def main():
    """Example usage of GPT5DriveProcessor."""
    print("🚀 GPT-5 Drive Processor Example")
    print("=" * 50)

    try:
        # Initialize configuration
        print("📋 Loading configuration...")
        config = PipelineConfig.from_env()

        # Initialize processor
        print("🔧 Initializing GPT5DriveProcessor...")
        processor = GPT5DriveProcessor(config)

        # Query Notion database for documents to process
        print("🔍 Querying Notion database for Inbox documents...")
        documents = processor.query_notion_documents(
            status_filter=ContentStatus.INBOX,
            limit=5  # Process up to 5 documents
        )

        if not documents:
            print("📭 No documents found in Inbox status")
            return

        print(f"📄 Found {len(documents)} documents to process:")
        for i, doc in enumerate(documents, 1):
            print(f"  {i}. {doc.title} (ID: {doc.file_id})")

        # Process all documents
        print("\n🎯 Starting batch processing...")

        def progress_callback(progress):
            """Print progress updates."""
            current = progress["current"]
            total = progress["total"]
            doc_title = progress["document"]
            status = progress["status"]
            quality = progress.get("quality_score", 0)
            time_taken = progress.get("processing_time", 0)

            print(f"  [{current}/{total}] {doc_title}")
            print(f"    Status: {status}")
            if status == "success":
                print(f"    Quality: {quality:.1f}/10 | Time: {time_taken:.1f}s")

        result = processor.process_batch(documents, progress_callback=progress_callback)

        # Display results
        print("\n📊 Processing Results:")
        print("-" * 30)

        summary = result["summary"]
        print(f"Total Documents: {summary['total_documents']}")
        print(f"Successful: {summary['successful']}")
        print(f"Failed: {summary['failed']}")
        print(f"Average Quality Score: {summary['average_quality_score']:.2f}/10")
        print(f"Average Processing Time: {summary['average_processing_time']:.1f}s")
        print(f"Total Batch Time: {summary['batch_processing_time']:.1f}s")

        # Show failed documents if any
        failed_results = [r for r in result["results"] if r["status"] == "failed"]
        if failed_results:
            print("\n❌ Failed Documents:")
            for failed in failed_results:
                print(f"  - {failed['document']}: {failed.get('error', 'Unknown error')}")

        # Get overall statistics
        stats = processor.get_processing_statistics()
        print(f"\n📈 Overall Statistics:")
        print(f"  Success Rate: {stats.get('success_rate', 0):.1%}")
        print(f"  Total Processed: {stats['processed']}")

        print("\n✅ Example completed successfully!")

    except Exception as e:
        print(f"❌ Error during processing: {e}")
        import traceback
        traceback.print_exc()


def example_single_document():
    """Example of processing a single document."""
    print("\n🎯 Single Document Processing Example")
    print("-" * 40)

    try:
        config = PipelineConfig.from_env()
        processor = GPT5DriveProcessor(config)

        # Get first Inbox document
        documents = processor.query_notion_documents(
            status_filter=ContentStatus.INBOX,
            limit=1
        )

        if not documents:
            print("📭 No documents available for single processing")
            return

        document = documents[0]
        print(f"📄 Processing: {document.title}")

        # Process single document
        result = processor.process_single_document(document)

        print(f"Status: {result['status']}")
        if result['status'] == 'success':
            print(f"Quality Score: {result['quality_score']:.1f}/10")
            print(f"Processing Time: {result['processing_time']:.1f}s")
            print(f"Content Type: {result['content_type']}")
            print(f"Blocks Created: {result['block_count']}")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}")

    except Exception as e:
        print(f"❌ Single document processing failed: {e}")


def example_process_all_inbox():
    """Example of processing all Inbox documents."""
    print("\n🚀 Process All Inbox Documents Example")
    print("-" * 45)

    try:
        config = PipelineConfig.from_env()
        processor = GPT5DriveProcessor(config)

        # Process all Inbox documents
        result = processor.process_all_inbox_documents(
            limit=10,  # Limit to 10 documents
            batch_size=3  # Process in batches of 3
        )

        summary = result["summary"]
        print(f"📊 Final Results:")
        print(f"  Total Documents: {summary['total_documents']}")
        print(f"  Successful: {summary['successful']}")
        print(f"  Failed: {summary['failed']}")

        if summary['total_documents'] > 0:
            success_rate = summary['successful'] / summary['total_documents']
            print(f"  Success Rate: {success_rate:.1%}")

    except Exception as e:
        print(f"❌ Process all inbox failed: {e}")


if __name__ == "__main__":
    print("🤖 GPT-5 Drive Processor Examples")
    print("=" * 50)

    # Run examples
    main()
    example_single_document()
    example_process_all_inbox()

    print("\n🏁 All examples completed!")