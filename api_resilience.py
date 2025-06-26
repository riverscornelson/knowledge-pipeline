"""
API resilience improvements for Notion API timeout and error handling
"""
import time
from functools import wraps
from typing import Callable, Any
from notion_client.errors import APIResponseError, RequestTimeoutError, HTTPResponseError
import logging

def with_notion_resilience(retries: int = 3, backoff_base: float = 2.0, timeout_multiplier: float = 1.5):
    """
    Decorator to add resilience to Notion API calls
    - Handles timeouts, 502 errors, and archived page errors
    - Implements exponential backoff
    - Graceful degradation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(retries):
                try:
                    return func(*args, **kwargs)
                    
                except (RequestTimeoutError, HTTPResponseError) as e:
                    last_exception = e
                    
                    # Handle specific HTTP errors
                    if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
                        status_code = e.response.status_code
                        if status_code == 502:  # Bad Gateway
                            print(f"   ⚠️  Notion API 502 error (attempt {attempt + 1}/{retries})")
                        elif status_code == 429:  # Rate limited
                            print(f"   ⚠️  Notion API rate limited (attempt {attempt + 1}/{retries})")
                        else:
                            print(f"   ⚠️  Notion API HTTP {status_code} error (attempt {attempt + 1}/{retries})")
                    else:
                        print(f"   ⚠️  Notion API timeout (attempt {attempt + 1}/{retries})")
                    
                    if attempt < retries - 1:
                        wait_time = backoff_base ** attempt * timeout_multiplier
                        print(f"   🔄 Retrying in {wait_time:.1f}s...")
                        time.sleep(wait_time)
                    
                except APIResponseError as e:
                    # Handle archived page errors specifically
                    if "archived" in str(e).lower():
                        print(f"   📦 Page is archived, skipping operation")
                        return None  # Graceful failure for archived pages
                    else:
                        last_exception = e
                        print(f"   ⚠️  Notion API error: {e} (attempt {attempt + 1}/{retries})")
                        
                        if attempt < retries - 1:
                            wait_time = backoff_base ** attempt
                            time.sleep(wait_time)
                
                except Exception as e:
                    # Unexpected errors
                    last_exception = e
                    print(f"   ⚠️  Unexpected error: {e} (attempt {attempt + 1}/{retries})")
                    
                    if attempt < retries - 1:
                        time.sleep(backoff_base ** attempt)
            
            # All retries exhausted
            print(f"   ❌ All {retries} attempts failed for {func.__name__}")
            raise last_exception
            
        return wrapper
    return decorator

def safe_notion_update(notion_update_func, page_id: str, status: str, *args, **kwargs):
    """
    Safe wrapper for notion_update that handles archived pages gracefully
    """
    try:
        return notion_update_func(page_id, status, *args, **kwargs)
    except APIResponseError as e:
        if "archived" in str(e).lower():
            print(f"   📦 Cannot update archived page {page_id} to {status}")
            return None
        raise

def safe_post_process(post_process_func, page_id: str, content: str):
    """
    Safe wrapper for post_process_page that handles archived pages gracefully
    """
    try:
        return post_process_func(page_id, content)
    except APIResponseError as e:
        if "archived" in str(e).lower():
            print(f"   📦 Cannot post-process archived page {page_id}")
            return None
        raise

def safe_add_blocks(add_blocks_func, page_id: str, *args, **kwargs):
    """
    Safe wrapper for adding blocks that handles archived pages gracefully
    """
    try:
        return add_blocks_func(page_id, *args, **kwargs)
    except APIResponseError as e:
        if "archived" in str(e).lower():
            print(f"   📦 Cannot add blocks to archived page {page_id}")
            return None
        raise

# Enhanced notion client with resilience
class ResilientNotionOps:
    """
    Wrapper class for Notion operations with built-in resilience
    """
    
    def __init__(self, notion_client):
        self.notion = notion_client
    
    @with_notion_resilience(retries=3, backoff_base=2.0)
    def query_database(self, database_id: str, **kwargs):
        """Query database with resilience"""
        return self.notion.databases.query(database_id=database_id, **kwargs)
    
    @with_notion_resilience(retries=3, backoff_base=1.5)
    def update_page(self, page_id: str, **kwargs):
        """Update page with resilience"""
        return self.notion.pages.update(page_id, **kwargs)
    
    @with_notion_resilience(retries=2, backoff_base=1.5)
    def append_blocks(self, page_id: str, **kwargs):
        """Append blocks with resilience"""
        return self.notion.blocks.children.append(page_id, **kwargs)
    
    @with_notion_resilience(retries=2, backoff_base=1.0)
    def retrieve_page(self, page_id: str):
        """Retrieve page with resilience"""
        return self.notion.pages.retrieve(page_id)
    
    @with_notion_resilience(retries=2, backoff_base=1.0)
    def list_blocks(self, block_id: str):
        """List blocks with resilience"""
        return self.notion.blocks.children.list(block_id=block_id)

def patch_existing_enricher():
    """
    Patch existing enrichment functions with resilience
    Apply this to existing code for immediate improvements
    """
    # This can be imported and used to enhance existing functions
    pass

# Quick fixes for immediate deployment
def quick_fix_archived_handling(func):
    """
    Quick decorator to add archived page handling to existing functions
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except APIResponseError as e:
            if "archived" in str(e).lower():
                print(f"   📦 Skipping operation on archived page")
                return None
            raise
        except (RequestTimeoutError, HTTPResponseError) as e:
            print(f"   ⚠️  API error: {e}, skipping operation")
            return None
    return wrapper