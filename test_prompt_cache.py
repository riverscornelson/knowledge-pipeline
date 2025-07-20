#!/usr/bin/env python3
"""Test script to verify Notion prompt cache is working correctly."""

import os
import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import logging

# Set up basic logging instead of using custom logger
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from core.prompt_config_enhanced import EnhancedPromptConfig

def test_prompt_cache():
    """Test the prompt cache with various content types."""
    logger = logging.getLogger("test_prompt_cache")
    
    # Check if Notion DB ID is set
    notion_db_id = os.getenv('NOTION_PROMPTS_DB_ID')
    if not notion_db_id:
        logger.error("NOTION_PROMPTS_DB_ID environment variable not set")
        return
    
    logger.info(f"Testing with Notion DB: {notion_db_id}")
    
    # Initialize the enhanced prompt config
    prompt_config = EnhancedPromptConfig(notion_db_id=notion_db_id)
    
    # Get stats
    stats = prompt_config.get_prompt_stats()
    logger.info(f"Prompt stats: {stats}")
    
    # Test various content types
    test_cases = [
        ("summarizer", "Market News"),
        ("summarizer", "Research"),
        ("summarizer", "Product"),
        ("insights", "Market News"),
        ("insights", "Research"),
        ("classifier", None),
        ("tagger", "Market News"),
    ]
    
    logger.info("\nTesting prompt lookups:")
    for analyzer, content_type in test_cases:
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing: {analyzer} / {content_type or 'default'}")
        
        config = prompt_config.get_prompt(analyzer, content_type)
        
        logger.info(f"Source: {config.get('source', 'unknown')}")
        logger.info(f"Temperature: {config.get('temperature', 'default')}")
        logger.info(f"Web Search: {config.get('web_search', False)}")
        if config.get('page_id'):
            logger.info(f"Notion Page: https://www.notion.so/{config['page_id'].replace('-', '')}")
        
        # Show first 200 chars of prompt
        system_prompt = config.get('system', '')
        if system_prompt:
            logger.info(f"Prompt preview: {system_prompt[:200]}...")
    
    # Show cache contents
    logger.info(f"\n{'='*60}")
    logger.info("Cache contents:")
    if hasattr(prompt_config, 'notion_prompts_cache'):
        for key in sorted(prompt_config.notion_prompts_cache.keys()):
            logger.info(f"  - {key}")
    else:
        logger.info("  (No cache available)")

if __name__ == "__main__":
    test_prompt_cache()