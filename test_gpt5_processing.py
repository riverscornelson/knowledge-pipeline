#!/usr/bin/env python3
"""
Test GPT-5 processing with our enhanced PDF extraction
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import logging
from core.config import PipelineConfig
from gpt5.drive_processor import GPT5DriveProcessor
from core.models import ContentStatus

def main():
    """Test the GPT-5 processor directly."""
    logging.basicConfig(level=logging.INFO)

    try:
        # Load configuration from environment
        config = PipelineConfig.from_env()

        # Initialize processor
        processor = GPT5DriveProcessor(config)

        print("🔍 Checking documents in different statuses...")

        # Check INBOX documents
        inbox_docs = processor.query_notion_documents(ContentStatus.INBOX, limit=10)
        print(f"📥 Found {len(inbox_docs)} documents in INBOX")

        # Check ENRICHED documents
        enriched_docs = processor.query_notion_documents(ContentStatus.ENRICHED, limit=10)
        print(f"✅ Found {len(enriched_docs)} documents in ENRICHED")

        # Check FAILED documents
        failed_docs = processor.query_notion_documents(ContentStatus.FAILED, limit=10)
        print(f"❌ Found {len(failed_docs)} documents in FAILED")

        # Show some details
        if inbox_docs:
            print("\n📥 INBOX Documents:")
            for doc in inbox_docs[:3]:
                print(f"  - {doc.title} (ID: {doc.file_id})")

        if enriched_docs:
            print("\n✅ ENRICHED Documents:")
            for doc in enriched_docs[:3]:
                print(f"  - {doc.title} (ID: {doc.file_id})")

        if failed_docs:
            print("\n❌ FAILED Documents:")
            for doc in failed_docs[:3]:
                print(f"  - {doc.title} (ID: {doc.file_id})")

        # Try to process inbox documents if any
        if inbox_docs:
            print(f"\n🚀 Processing {len(inbox_docs)} INBOX documents...")
            results = processor.process_all_inbox_documents(limit=5, batch_size=2)
            print(f"📊 Results: {results['summary']}")
        else:
            print("\n⚠️  No INBOX documents to process")

        print("\n✅ Test completed successfully!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()