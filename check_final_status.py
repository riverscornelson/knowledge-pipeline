#!/usr/bin/env python3
"""
Check final processing status of all documents
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import logging
from core.config import PipelineConfig
from gpt5.drive_processor import GPT5DriveProcessor
from core.models import ContentStatus

def main():
    """Check final status of document processing."""
    logging.basicConfig(level=logging.WARNING)  # Reduce log noise

    try:
        # Load configuration from environment
        config = PipelineConfig.from_env()

        # Initialize processor
        processor = GPT5DriveProcessor(config)

        print("📊 FINAL PROCESSING STATUS REPORT")
        print("=" * 50)

        # Check all statuses
        statuses = [
            (ContentStatus.INBOX, "📥 INBOX"),
            (ContentStatus.PROCESSING, "⏳ PROCESSING"),
            (ContentStatus.ENRICHED, "✅ ENRICHED"),
            (ContentStatus.FAILED, "❌ FAILED")
        ]

        total_docs = 0

        for status, label in statuses:
            docs = processor.query_notion_documents(status, limit=50)
            count = len(docs)
            total_docs += count

            print(f"{label}: {count} documents")

            if count > 0 and count <= 5:  # Show details for small numbers
                for doc in docs:
                    print(f"  - {doc.title}")

        print("=" * 50)
        print(f"📈 TOTAL DOCUMENTS: {total_docs}")

        # Check if there are any remaining failed documents
        failed_docs = processor.query_notion_documents(ContentStatus.FAILED)
        if failed_docs:
            print(f"\n⚠️  {len(failed_docs)} documents still in FAILED status")
            print("These may need manual review or alternative processing methods")
        else:
            print("\n🎉 ALL DOCUMENTS SUCCESSFULLY PROCESSED!")

        # Get processing statistics
        stats = processor.get_processing_statistics()
        if stats.get('processed', 0) > 0:
            print(f"\n📊 PROCESSING STATISTICS:")
            print(f"Success Rate: {stats.get('success_rate', 0)*100:.1f}%")
            print(f"Average Quality: {stats.get('avg_quality_score', 0):.1f}/10")
            print(f"Average Time: {stats.get('average_processing_time', 0):.1f}s")

        print("\n✅ Status check completed!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()