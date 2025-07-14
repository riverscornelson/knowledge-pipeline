#!/usr/bin/env python3
"""
Script to view enriched content from the Notion database.
Allows examining AI-generated summaries, classifications, and insights.
"""

import os
import sys
from typing import Dict, List, Any, Optional

# Add src to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from core.config import PipelineConfig
from core.notion_client import NotionClient
from core.models import ContentStatus


def get_enriched_pages(notion_client: NotionClient, limit: int = 10) -> List[Dict[str, Any]]:
    """Get pages with Status=Enriched."""
    filter_obj = {
        "property": "Status",
        "select": {"equals": ContentStatus.ENRICHED.value}
    }
    
    response = notion_client.client.databases.query(
        database_id=notion_client.db_id,
        filter=filter_obj,
        sorts=[{
            "property": "Created Date",
            "direction": "descending"
        }],
        page_size=limit
    )
    
    return response["results"]


def extract_property_value(properties: Dict[str, Any], prop_name: str, prop_type: str) -> Any:
    """Extract value from a Notion property."""
    prop = properties.get(prop_name, {})
    
    if prop_type == "title" and prop.get("title"):
        return prop["title"][0]["text"]["content"]
    elif prop_type == "rich_text" and prop.get("rich_text"):
        return prop["rich_text"][0]["text"]["content"]
    elif prop_type == "select" and prop.get("select"):
        return prop["select"]["name"]
    elif prop_type == "multi_select" and prop.get("multi_select"):
        return [item["name"] for item in prop["multi_select"]]
    elif prop_type == "url" and prop.get("url"):
        return prop["url"]
    elif prop_type == "date" and prop.get("date"):
        return prop["date"]["start"]
    
    return None


def get_page_content_blocks(notion_client: NotionClient, page_id: str) -> List[Dict[str, Any]]:
    """Get content blocks from a Notion page."""
    try:
        response = notion_client.client.blocks.children.list(block_id=page_id)
        return response["results"]
    except Exception as e:
        print(f"Error fetching blocks for page {page_id}: {e}")
        return []


def extract_toggle_content(blocks: List[Dict[str, Any]], toggle_title: str) -> Optional[str]:
    """Extract content from a specific toggle block."""
    for block in blocks:
        if block.get("type") == "toggle":
            toggle = block.get("toggle", {})
            rich_text = toggle.get("rich_text", [])
            
            if rich_text and toggle_title.lower() in rich_text[0].get("text", {}).get("content", "").lower():
                # Get children of this toggle
                if "children" in toggle:
                    content_parts = []
                    for child in toggle["children"]:
                        if child.get("type") == "paragraph":
                            para_text = child.get("paragraph", {}).get("rich_text", [])
                            if para_text:
                                content_parts.append(para_text[0].get("text", {}).get("content", ""))
                    return "\n".join(content_parts)
    
    return None


def display_enriched_content(pages: List[Dict[str, Any]], notion_client: NotionClient, detailed: bool = False):
    """Display enriched content in a readable format."""
    for i, page in enumerate(pages, 1):
        properties = page["properties"]
        page_id = page["id"]
        
        # Extract basic properties
        title = extract_property_value(properties, "Title", "title")
        summary = extract_property_value(properties, "Summary", "rich_text")
        content_type = extract_property_value(properties, "Content-Type", "select")
        ai_primitives = extract_property_value(properties, "AI-Primitive", "multi_select")
        vendor = extract_property_value(properties, "Vendor", "select")
        drive_url = extract_property_value(properties, "Drive URL", "url")
        article_url = extract_property_value(properties, "Article URL", "url")
        created_date = extract_property_value(properties, "Created Date", "date")
        
        print(f"\n{'='*80}")
        print(f"📄 DOCUMENT {i}: {title}")
        print(f"{'='*80}")
        
        print(f"📅 Created: {created_date or 'Unknown'}")
        print(f"🔗 Source: {drive_url or article_url or 'Unknown'}")
        print(f"📝 Type: {content_type or 'Unknown'}")
        print(f"🤖 AI Primitives: {', '.join(ai_primitives) if ai_primitives else 'None'}")
        print(f"🏢 Vendor: {vendor or 'None'}")
        
        print(f"\n📋 BRIEF SUMMARY:")
        print(f"   {summary or 'No summary available'}")
        
        if detailed:
            print(f"\n🔍 DETAILED ANALYSIS:")
            
            # Get page content blocks
            blocks = get_page_content_blocks(notion_client, page_id)
            
            if blocks:
                # Extract detailed content from toggles
                core_summary = extract_toggle_content(blocks, "Core Summary")
                key_insights = extract_toggle_content(blocks, "Key Insights")
                classification = extract_toggle_content(blocks, "Classification")
                raw_content = extract_toggle_content(blocks, "Raw Content")
                
                if core_summary:
                    print(f"\n📊 CORE SUMMARY:")
                    print(f"{core_summary[:500]}{'...' if len(core_summary) > 500 else ''}")
                
                if key_insights:
                    print(f"\n💡 KEY INSIGHTS:")
                    print(f"{key_insights[:800]}{'...' if len(key_insights) > 800 else ''}")
                
                if classification:
                    print(f"\n🎯 CLASSIFICATION DETAILS:")
                    print(f"{classification}")
                
                if raw_content:
                    print(f"\n📄 RAW CONTENT (first 300 chars):")
                    print(f"{raw_content[:300]}{'...' if len(raw_content) > 300 else ''}")
            else:
                print("   No detailed content blocks found.")


def main():
    """Main function to display enriched content."""
    import argparse
    
    parser = argparse.ArgumentParser(description="View enriched content from Notion database")
    parser.add_argument("--limit", type=int, default=5, help="Number of documents to show (default: 5)")
    parser.add_argument("--detailed", action="store_true", help="Show detailed analysis content")
    parser.add_argument("--search", type=str, help="Search for specific document title")
    
    args = parser.parse_args()
    
    try:
        # Load configuration
        config = PipelineConfig.from_env()
        notion_client = NotionClient(config.notion)
        
        if args.search:
            # Search for specific document
            filter_obj = {
                "and": [
                    {
                        "property": "Status",
                        "select": {"equals": ContentStatus.ENRICHED.value}
                    },
                    {
                        "property": "Title",
                        "title": {"contains": args.search}
                    }
                ]
            }
            
            response = notion_client.client.databases.query(
                database_id=notion_client.db_id,
                filter=filter_obj,
                sorts=[{
                    "property": "Created Date", 
                    "direction": "descending"
                }]
            )
            pages = response["results"]
            
            if not pages:
                print(f"No enriched documents found matching '{args.search}'")
                return
            
            print(f"Found {len(pages)} document(s) matching '{args.search}':")
            
        else:
            # Get recent enriched pages
            pages = get_enriched_pages(notion_client, args.limit)
            
            if not pages:
                print("No enriched documents found in the database.")
                return
            
            print(f"📚 RECENT ENRICHED DOCUMENTS (showing {len(pages)} of latest):")
        
        # Display the content
        display_enriched_content(pages, notion_client, args.detailed)
        
        if not args.detailed:
            print(f"\n💡 Use --detailed flag to see full AI analysis content")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())