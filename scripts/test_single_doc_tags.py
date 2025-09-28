#!/usr/bin/env python3
"""Test processing a single document with detailed logging"""

import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.config import PipelineConfig
from core.notion_client import NotionClient
from gpt5.drive_processor import GPT5DriveProcessor
from utils.logging import setup_logger

# Set up detailed logging
logging.basicConfig(level=logging.DEBUG)

def test_single_document():
    """Test processing a single specific document"""

    # Load config
    config = PipelineConfig.from_env()

    # Initialize processor
    processor = GPT5DriveProcessor(config)

    # Initialize Notion client to find the document
    notion_client = NotionClient(config.notion)

    # Find the "Future of Work with AI Agents" document
    print("\n🔍 Finding 'Future of Work with AI Agents' document...")

    # Query for the specific document
    response = notion_client.client.databases.query(
        database_id=config.notion.sources_db_id,
        filter={
            "property": "Title",
            "title": {
                "contains": "Future of Work with AI Agents"
            }
        },
        page_size=1
    )

    if not response["results"]:
        print("❌ Document not found!")
        return

    page = response["results"][0]
    page_id = page["id"]
    title = page["properties"]["Title"]["title"][0]["text"]["content"]
    drive_url = page["properties"]["Drive URL"]["url"]

    print(f"✅ Found document: {title}")
    print(f"   Page ID: {page_id}")
    print(f"   Drive URL: {drive_url}")

    # Extract file ID from Drive URL
    file_id = None
    if "/d/" in drive_url:
        file_id = drive_url.split("/d/")[1].split("/")[0]

    if not file_id:
        print("❌ Could not extract file ID from Drive URL")
        return

    print(f"   File ID: {file_id}")

    # Create document object
    from dataclasses import dataclass

    @dataclass
    class DriveDocument:
        page_id: str
        title: str
        file_id: str
        drive_url: str

    document = DriveDocument(
        page_id=page_id,
        title=title,
        file_id=file_id,
        drive_url=drive_url
    )

    print("\n🚀 Processing document...")
    print("-" * 50)

    # Process the document
    result = processor.process_single_document(document)

    print("\n📊 Processing Results:")
    print(f"   Status: {result['status']}")
    if result.get('error'):
        print(f"   Error: {result['error']}")
    else:
        print(f"   Processing time: {result.get('processing_time', 0):.1f}s")
        print(f"   Quality score: {result.get('quality_score', 0):.1f}")
        print(f"   Tags generated: {result.get('tags_generated', False)}")
        print(f"   Tag generation time: {result.get('tag_time', 0):.1f}s")
        print(f"   Topical tags count: {result.get('topical_tags_count', 0)}")
        print(f"   Confidence: {result.get('confidence', 0):.2f}")

    # Check the updated Notion page
    print("\n📝 Checking updated Notion page...")
    updated_page = notion_client.client.pages.retrieve(page_id=page_id)

    props = updated_page["properties"]
    print(f"   Content-Type: {props.get('Content-Type', {}).get('select', {}).get('name', 'Not set')}")

    topical_tags = props.get('Topical-Tags', {}).get('multi_select', [])
    print(f"   Topical-Tags: {', '.join([t['name'] for t in topical_tags]) if topical_tags else 'None'}")

    domain_tags = props.get('Domain-Tags', {}).get('multi_select', [])
    print(f"   Domain-Tags: {', '.join([t['name'] for t in domain_tags]) if domain_tags else 'None'}")

    ai_primitives = props.get('AI-Primitive', {}).get('multi_select', [])
    print(f"   AI-Primitives: {', '.join([t['name'] for t in ai_primitives]) if ai_primitives else 'None'}")

    vendor = props.get('Vendor', {}).get('select', {}).get('name', 'Not set')
    print(f"   Vendor: {vendor}")

if __name__ == "__main__":
    test_single_document()