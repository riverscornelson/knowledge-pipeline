"""
Notion API client wrapper with common operations.
"""
import time
from typing import List, Dict, Any, Optional, Generator
from notion_client import Client
from .models import SourceContent, ContentStatus
from .config import NotionConfig


class NotionClient:
    """Enhanced Notion client for the knowledge pipeline."""
    
    def __init__(self, config: NotionConfig):
        """Initialize Notion client with configuration."""
        self.config = config
        self.client = Client(auth=config.token)
        self.db_id = config.sources_db_id
    
    def get_inbox_items(self, limit: Optional[int] = None) -> Generator[Dict[str, Any], None, None]:
        """Get all items with Status=Inbox."""
        filter_obj = {
            "property": "Status",
            "select": {"equals": ContentStatus.INBOX.value}
        }
        
        kwargs = {
            "database_id": self.db_id,
            "filter": filter_obj,
            "page_size": min(limit or 100, 100)
        }
        
        count = 0
        while True:
            response = self.client.databases.query(**kwargs)
            
            for page in response["results"]:
                yield page
                count += 1
                if limit and count >= limit:
                    return
            
            if not response.get("has_more"):
                break
            
            kwargs["start_cursor"] = response["next_cursor"]
    
    def check_hash_exists(self, content_hash: str) -> bool:
        """Check if a content hash already exists in the database."""
        query = self.client.databases.query(
            database_id=self.db_id,
            filter={
                "property": "Hash",
                "rich_text": {"equals": content_hash}
            }
        )
        return len(query["results"]) > 0
    
    def get_existing_drive_files(self) -> tuple[set[str], set[str]]:
        """Get sets of Drive file IDs and hashes already in Notion."""
        filter_obj = {"property": "Drive URL", "url": {"is_not_empty": True}}
        kwargs = {
            "database_id": self.db_id,
            "filter": filter_obj,
            "page_size": 100
        }
        
        ids: set[str] = set()
        hashes: set[str] = set()
        
        while True:
            resp = self.client.databases.query(**kwargs)
            
            for page in resp["results"]:
                # Extract Drive ID
                url = page["properties"].get("Drive URL", {}).get("url")
                if url:
                    try:
                        file_id = url.split("/d/")[1].split("/")[0]
                        ids.add(file_id)
                    except:
                        pass
                
                # Extract hash
                hash_prop = page["properties"].get("Hash", {}).get("rich_text", [])
                if hash_prop and hash_prop[0].get("plain_text"):
                    hashes.add(hash_prop[0]["plain_text"])
            
            if not resp.get("has_more"):
                break
            
            kwargs["start_cursor"] = resp["next_cursor"]
        
        return ids, hashes
    
    def create_page(self, content: SourceContent) -> str:
        """Create a new page from SourceContent."""
        response = self.client.pages.create(
            parent={"database_id": self.db_id},
            properties=content.to_notion_properties()
        )
        return response["id"]
    
    def update_page_status(self, page_id: str, status: ContentStatus, error_msg: Optional[str] = None):
        """Update the status of a page."""
        properties = {
            "Status": {"select": {"name": status.value}}
        }
        
        if error_msg and status == ContentStatus.FAILED:
            # Add error to page body if failed
            self.client.blocks.children.append(
                block_id=page_id,
                children=[{
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{
                            "type": "text",
                            "text": {"content": f"Error: {error_msg}"}
                        }]
                    }
                }]
            )
        
        self.client.pages.update(page_id=page_id, properties=properties)
    
    def add_content_blocks(self, page_id: str, blocks: List[Dict[str, Any]]):
        """Add content blocks to a page."""
        # Notion API limits to 100 blocks per request
        for i in range(0, len(blocks), 100):
            batch = blocks[i:i+100]
            self.client.blocks.children.append(
                block_id=page_id,
                children=batch
            )
            time.sleep(0.3)  # Rate limiting