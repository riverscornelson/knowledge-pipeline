#!/usr/bin/env python3
"""
Debug script to examine Notion page structure and blocks.
"""

import os
import sys
import json

# Add src to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from core.config import PipelineConfig
from core.notion_client import NotionClient


def debug_page_blocks(notion_client: NotionClient, page_id: str):
    """Debug the block structure of a specific page."""
    try:
        # Get page info
        page = notion_client.client.pages.retrieve(page_id=page_id)
        title = page["properties"]["Title"]["title"][0]["text"]["content"]
        
        print(f"📄 Page: {title}")
        print(f"🆔 ID: {page_id}")
        print(f"📊 Properties:")
        
        # Show key properties
        for prop_name in ["Status", "Content-Type", "AI-Primitive", "Vendor", "Summary"]:
            prop = page["properties"].get(prop_name, {})
            if prop.get("type") == "select" and prop.get("select"):
                print(f"   {prop_name}: {prop['select']['name']}")
            elif prop.get("type") == "multi_select" and prop.get("multi_select"):
                values = [item["name"] for item in prop["multi_select"]]
                print(f"   {prop_name}: {', '.join(values)}")
            elif prop.get("type") == "rich_text" and prop.get("rich_text"):
                text = prop["rich_text"][0]["text"]["content"][:100]
                print(f"   {prop_name}: {text}{'...' if len(text) >= 100 else ''}")
        
        print(f"\n🧱 BLOCK STRUCTURE:")
        
        # Get blocks
        blocks_response = notion_client.client.blocks.children.list(block_id=page_id)
        blocks = blocks_response["results"]
        
        print(f"   Found {len(blocks)} top-level blocks")
        
        for i, block in enumerate(blocks):
            block_type = block.get("type")
            print(f"\n   Block {i+1}: {block_type}")
            
            if block_type == "toggle":
                toggle = block.get("toggle", {})
                rich_text = toggle.get("rich_text", [])
                title_text = ""
                if rich_text:
                    title_text = rich_text[0].get("text", {}).get("content", "")
                
                print(f"      Toggle Title: {title_text}")
                print(f"      Has Children: {toggle.get('has_children', False)}")
                
                # Try to get children if they exist
                if toggle.get("has_children"):
                    try:
                        children_response = notion_client.client.blocks.children.list(block_id=block["id"])
                        children = children_response["results"]
                        print(f"      Children Count: {len(children)}")
                        
                        # Show first few children
                        for j, child in enumerate(children[:3]):
                            child_type = child.get("type")
                            if child_type == "paragraph":
                                para_text = child.get("paragraph", {}).get("rich_text", [])
                                if para_text:
                                    text = para_text[0].get("text", {}).get("content", "")[:100]
                                    print(f"         Child {j+1} (paragraph): {text}{'...' if len(text) >= 100 else ''}")
                        
                        if len(children) > 3:
                            print(f"         ... and {len(children) - 3} more children")
                            
                    except Exception as e:
                        print(f"      Error fetching children: {e}")
        
    except Exception as e:
        print(f"Error: {e}")


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Debug Notion page blocks")
    parser.add_argument("--page-id", type=str, help="Specific page ID to debug")
    parser.add_argument("--search", type=str, help="Search for a page by title")
    
    args = parser.parse_args()
    
    try:
        config = PipelineConfig.from_env()
        notion_client = NotionClient(config.notion)
        
        if args.page_id:
            debug_page_blocks(notion_client, args.page_id)
        elif args.search:
            # Search for the page first
            from core.models import ContentStatus
            
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
                filter=filter_obj
            )
            
            pages = response["results"]
            if not pages:
                print(f"No pages found matching '{args.search}'")
                return
            
            print(f"Found {len(pages)} page(s) matching '{args.search}':")
            for page in pages:
                debug_page_blocks(notion_client, page["id"])
        else:
            print("Please provide either --page-id or --search")
    
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()