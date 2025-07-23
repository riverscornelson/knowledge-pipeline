#!/usr/bin/env python3
"""
Basic Usage Example for Knowledge Pipeline v4.0.0

This example demonstrates the simplest way to use the Knowledge Pipeline
to process documents from Google Drive and enrich them with AI.
"""

import os
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester
from src.enrichment.pipeline_processor import PipelineProcessor


def main():
    """Run a basic pipeline to process Drive content."""
    
    # 1. Load configuration from environment
    print("Loading configuration...")
    config = PipelineConfig.from_env()
    
    # 2. Initialize Notion client
    print("Connecting to Notion...")
    notion_client = NotionClient(config.notion)
    
    # 3. Ingest content from Google Drive
    print("\nIngesting content from Google Drive...")
    drive_ingester = DriveIngester(config, notion_client)
    ingest_stats = drive_ingester.ingest()
    
    print(f"✅ Ingested {ingest_stats['new']} new documents")
    print(f"⏭️  Skipped {ingest_stats['skipped']} existing documents")
    
    # 4. Enrich content with AI
    print("\nEnriching content with AI...")
    processor = PipelineProcessor(config, notion_client)
    enrich_stats = processor.process_batch(batch_size=5)
    
    print(f"✅ Enriched {enrich_stats['processed']} documents")
    print(f"❌ Failed to process {enrich_stats['failed']} documents")
    
    # 5. View results
    print("\n🎉 Pipeline complete! Check your Notion database for enriched content.")


if __name__ == "__main__":
    # Ensure environment variables are loaded
    from dotenv import load_dotenv
    load_dotenv()
    
    # Run the pipeline
    main()