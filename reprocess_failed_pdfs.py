#!/usr/bin/env python3
"""
Reprocess failed PDF documents with improved extraction
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import logging
from core.config import PipelineConfig
from gpt5.drive_processor import GPT5DriveProcessor
from core.models import ContentStatus

def main():
    """Reprocess failed documents with improved PDF extraction."""
    logging.basicConfig(level=logging.INFO)

    try:
        # Load configuration from environment
        config = PipelineConfig.from_env()

        # Initialize processor
        processor = GPT5DriveProcessor(config)

        print("🔍 Finding failed documents...")

        # Get failed documents
        failed_docs = processor.query_notion_documents(ContentStatus.FAILED, limit=10)
        print(f"❌ Found {len(failed_docs)} failed documents")

        if failed_docs:
            print("\n📋 Failed documents to reprocess:")
            for doc in failed_docs:
                print(f"  - {doc.title} (ID: {doc.file_id})")

            print(f"\n🚀 Reprocessing {len(failed_docs)} failed documents...")

            # Process each failed document individually for better error reporting
            successful = 0
            still_failed = 0

            for i, doc in enumerate(failed_docs, 1):
                print(f"\n📄 Processing {i}/{len(failed_docs)}: {doc.title}")
                try:
                    # Reset the document status to INBOX so it can be reprocessed
                    processor.notion_client.update_page_status(doc.page_id, ContentStatus.INBOX)
                    print(f"  ✅ Reset status to INBOX")

                    # Process the document
                    result = processor.process_single_document(doc)

                    if result["status"] == "success":
                        successful += 1
                        print(f"  ✅ SUCCESS - Quality: {result.get('quality_score', 'N/A'):.1f}/10")
                        print(f"      Blocks: {result.get('block_count', 'N/A')}, Time: {result.get('processing_time', 0):.1f}s")
                    else:
                        still_failed += 1
                        print(f"  ❌ FAILED - {result.get('error', 'Unknown error')}")

                except Exception as e:
                    still_failed += 1
                    print(f"  ❌ EXCEPTION - {str(e)}")

                # Small delay between documents
                import time
                time.sleep(2)

            print(f"\n📊 REPROCESSING SUMMARY:")
            print(f"✅ Successful: {successful}")
            print(f"❌ Still failed: {still_failed}")
            print(f"📈 Success rate: {successful/len(failed_docs)*100:.1f}%")

        else:
            print("\n✅ No failed documents to reprocess!")

        print("\n✅ Reprocessing completed!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()