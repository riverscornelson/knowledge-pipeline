"""
API resilience utilities for robust API interactions.
"""
import time
from functools import wraps
from typing import Callable, Any, Optional
from notion_client.errors import APIResponseError, RequestTimeoutError, HTTPResponseError
import logging


def with_notion_resilience(retries: int = 3, backoff_base: float = 2.0, timeout_multiplier: float = 1.5):
    """
    Decorator to add resilience to Notion API calls.
    
    Features:
    - Handles timeouts, 502 errors, and archived page errors
    - Implements exponential backoff
    - Graceful degradation for known issues
    
    Args:
        retries: Maximum number of retry attempts
        backoff_base: Base for exponential backoff calculation
        timeout_multiplier: Multiplier for timeout wait time
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            logger = logging.getLogger(__name__)
            
            for attempt in range(retries):
                try:
                    return func(*args, **kwargs)
                    
                except (RequestTimeoutError, HTTPResponseError) as e:
                    last_exception = e
                    
                    # Handle specific HTTP errors
                    if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
                        status_code = e.response.status_code
                        if status_code == 502:  # Bad Gateway
                            logger.warning(f"Notion API 502 error (attempt {attempt + 1}/{retries})")
                        elif status_code == 429:  # Rate limited
                            logger.warning(f"Notion API rate limited (attempt {attempt + 1}/{retries})")
                        else:
                            logger.warning(f"Notion API HTTP {status_code} error (attempt {attempt + 1}/{retries})")
                    else:
                        logger.warning(f"Notion API timeout (attempt {attempt + 1}/{retries})")
                    
                    if attempt < retries - 1:
                        wait_time = backoff_base ** attempt * timeout_multiplier
                        logger.info(f"Retrying in {wait_time:.1f}s...")
                        time.sleep(wait_time)
                    
                except APIResponseError as e:
                    # Handle archived page errors specifically
                    if "archived" in str(e).lower():
                        logger.info("Page is archived, skipping operation")
                        return None  # Graceful failure for archived pages
                    
                    # Handle validation errors
                    if "validation_error" in str(e).lower():
                        logger.error(f"Notion validation error: {e}")
                        raise  # Don't retry validation errors
                    
                    last_exception = e
                    logger.error(f"Notion API error: {e}")
                    
                    if attempt < retries - 1:
                        wait_time = backoff_base ** attempt
                        time.sleep(wait_time)
                
                except Exception as e:
                    # Unknown error - log and re-raise
                    logger.error(f"Unexpected error in Notion API call: {e}")
                    raise
            
            # All retries exhausted
            logger.error(f"All {retries} attempts failed")
            if last_exception:
                raise last_exception
            
        return wrapper
    return decorator


class ResilientNotionOps:
    """Helper class for resilient Notion operations."""
    
    def __init__(self, notion_client):
        """Initialize with Notion client."""
        self.notion = notion_client
        self.logger = logging.getLogger(__name__)
    
    @with_notion_resilience()
    def query_database(self, database_id: str, **kwargs) -> Optional[dict]:
        """Query Notion database with resilience."""
        return self.notion.databases.query(database_id=database_id, **kwargs)
    
    @with_notion_resilience()
    def update_page(self, page_id: str, **kwargs) -> Optional[dict]:
        """Update Notion page with resilience."""
        return self.notion.pages.update(page_id=page_id, **kwargs)
    
    @with_notion_resilience()
    def create_page(self, **kwargs) -> Optional[dict]:
        """Create Notion page with resilience."""
        return self.notion.pages.create(**kwargs)
    
    @with_notion_resilience()
    def append_blocks(self, block_id: str, children: list) -> Optional[dict]:
        """Append blocks to Notion page with resilience."""
        return self.notion.blocks.children.append(block_id=block_id, children=children)