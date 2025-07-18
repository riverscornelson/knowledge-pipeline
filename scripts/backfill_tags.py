#!/usr/bin/env python3
"""
Backfill tags for existing enriched content in Notion.

This script:
1. Queries all enriched content without tags
2. Extracts content from Drive URLs or page content
3. Runs through ContentTagger to generate tags
4. Updates Notion pages with the new tags
"""
import os
import sys
from pathlib import Path
import time
import argparse
import logging
from typing import Dict, List, Optional

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.core.prompt_config import PromptConfig
from src.enrichment.content_tagger import ContentTagger
from src.drive.pdf_processor import PDFProcessor
from src.utils.logging import setup_logger


def setup_google_drive(config: PipelineConfig, logger):
    """Setup Google Drive service for PDF extraction."""
    try:
        if not config.google_drive.service_account_path:
            logger.warning("Google credentials path not configured")
            return None
            
        if not os.path.exists(config.google_drive.service_account_path):
            logger.warning(f"Google credentials file not found: {config.google_drive.service_account_path}")
            return None
            
        from googleapiclient.discovery import build
        from google.oauth2.service_account import Credentials
        
        credentials = Credentials.from_service_account_file(
            config.google_drive.service_account_path
        )
        drive_service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        logger.info("Google Drive service initialized successfully")
        return drive_service
    except Exception as e:
        logger.warning(f"Failed to setup Google Drive: {e}")
        return None


def extract_drive_file_id(drive_url: str) -> Optional[str]:
    """Extract Google Drive file ID from URL."""
    try:
        if "/d/" in drive_url:
            return drive_url.split("/d/")[1].split("/")[0]
        elif "id=" in drive_url:
            return drive_url.split("id=")[1].split("&")[0]
    except:
        pass
    return None


def get_items_without_tags(notion_client: NotionClient, logger) -> List[Dict]:
    """Query Notion for enriched items without tags."""
    logger.info("Querying Notion for enriched items without tags...")
    
    try:
        # Query for enriched items
        filter_params = {
            "property": "Status",
            "select": {"equals": "Enriched"}
        }
        
        response = notion_client.client.databases.query(
            database_id=notion_client.db_id,
            filter=filter_params,
            page_size=100
        )
        
        items_without_tags = []
        total_enriched = 0
        
        for item in response.get('results', []):
            total_enriched += 1
            properties = item.get('properties', {})
            
            # Check if tags are missing or empty
            topical_tags = properties.get('Topical-Tags', {}).get('multi_select', [])
            domain_tags = properties.get('Domain-Tags', {}).get('multi_select', [])
            
            if not topical_tags and not domain_tags:
                items_without_tags.append(item)
        
        logger.info(f"Found {len(items_without_tags)} items without tags out of {total_enriched} enriched items")
        return items_without_tags
        
    except Exception as e:
        logger.error(f"Failed to query Notion: {e}")
        return []


def extract_content(item: Dict, drive_service, pdf_processor, logger) -> Optional[str]:
    """Extract content from item (Drive URL or page content)."""
    properties = item.get('properties', {})
    
    # Try Drive URL first
    drive_url = properties.get('Drive URL', {}).get('url')
    if drive_url:
        file_id = extract_drive_file_id(drive_url)
        if file_id and drive_service:
            try:
                pdf_content = pdf_processor.download_file(drive_service, file_id)
                text_content = pdf_processor.extract_text_from_pdf(pdf_content)
                if text_content:
                    logger.debug(f"Extracted {len(text_content)} characters from Drive PDF")
                    return text_content
            except Exception as e:
                logger.warning(f"Failed to extract Drive content: {e}")
    
    # Fall back to page content
    # TODO: Implement page content extraction if needed
    
    return None


def main():
    parser = argparse.ArgumentParser(description='Backfill tags for existing content')
    parser.add_argument('--limit', type=int, help='Limit number of items to process')
    parser.add_argument('--dry-run', action='store_true', help='Run without updating Notion')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    args = parser.parse_args()
    
    # Setup
    logger = setup_logger('backfill_tags')
    
    # Set log level based on verbose flag
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        # Also set debug level for all handlers
        for handler in logger.handlers:
            handler.setLevel(logging.DEBUG)
    
    logger.info("Starting tag backfill process...")
    
    try:
        # Load configuration
        config = PipelineConfig.from_env()
        prompt_config = PromptConfig()
        
        # Initialize clients
        notion_client = NotionClient(config.notion)
        content_tagger = ContentTagger(config, notion_client, prompt_config)
        
        # Setup Drive if available
        drive_service = setup_google_drive(config, logger)
        pdf_processor = PDFProcessor() if drive_service else None
        
        if not drive_service:
            logger.warning("Google Drive not configured - will skip Drive URLs")
        
        # Get items without tags
        items = get_items_without_tags(notion_client, logger)
        
        if not items:
            logger.info("No items found that need tags")
            return
        
        # Apply limit if specified
        if args.limit:
            items = items[:args.limit]
            logger.info(f"Limited to processing {len(items)} items")
        
        # Process items
        success_count = 0
        error_count = 0
        
        for i, item in enumerate(items, 1):
            page_id = item['id']
            title = item['properties'].get('Title', {}).get('title', [])
            title_text = title[0]['text']['content'] if title else 'Untitled'
            
            logger.info(f"\n[{i}/{len(items)}] Processing: {title_text}")
            
            try:
                # Extract content
                content = extract_content(item, drive_service, pdf_processor, logger)
                
                if not content:
                    logger.warning(f"No content extracted for {title_text}")
                    error_count += 1
                    continue
                
                # Get content type from item
                content_type = item['properties'].get('Content-Type', {}).get('select', {}).get('name', 'Other')
                
                # Generate tags
                logger.info(f"Generating tags for {title_text} (type: {content_type})")
                tag_result = content_tagger.analyze(content, title_text, content_type)
                
                if not tag_result.get('success'):
                    logger.error(f"Tag generation failed: {tag_result.get('error')}")
                    error_count += 1
                    continue
                
                topical_tags = tag_result.get('topical_tags', [])
                domain_tags = tag_result.get('domain_tags', [])
                
                logger.info(f"Generated tags - Topical: {topical_tags}, Domain: {domain_tags}")
                
                # Update Notion (unless dry run)
                if not args.dry_run:
                    properties = {}
                    
                    if topical_tags:
                        properties["Topical-Tags"] = {
                            "multi_select": [{"name": tag} for tag in topical_tags]
                        }
                    
                    if domain_tags:
                        properties["Domain-Tags"] = {
                            "multi_select": [{"name": tag} for tag in domain_tags]
                        }
                    
                    if properties:
                        notion_client.client.pages.update(page_id=page_id, properties=properties)
                        logger.info(f"Updated Notion page with tags")
                    
                    # Rate limiting
                    time.sleep(0.5)
                
                success_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process {title_text}: {e}")
                error_count += 1
                continue
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info(f"Backfill complete!")
        logger.info(f"Success: {success_count}")
        logger.info(f"Errors: {error_count}")
        
        if args.dry_run:
            logger.info("(Dry run - no changes made to Notion)")
            
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()