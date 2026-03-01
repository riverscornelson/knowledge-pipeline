"""Notion client: query database, create/update pages, add blocks."""
import time
import logging
from typing import List, Dict, Any, Optional

from notion_client import Client

from .config import NotionConfig
from .models import SourceContent, ContentStatus

log = logging.getLogger(__name__)


class NotionClient:
    """Simplified Notion client for the knowledge pipeline."""

    def __init__(self, config: NotionConfig):
        self.client = Client(auth=config.token)
        self.db_id = config.sources_db_id

    def hash_exists(self, content_hash: str) -> bool:
        """Check if a content hash already exists in the database."""
        resp = self.client.databases.query(
            database_id=self.db_id,
            filter={"property": "Hash", "rich_text": {"equals": content_hash}},
        )
        return len(resp["results"]) > 0

    def create_page(self, content: SourceContent) -> str:
        """Create a new page and return its ID."""
        resp = self.client.pages.create(
            parent={"database_id": self.db_id},
            properties=content.to_notion_properties(),
        )
        return resp["id"]

    def update_page_properties(self, page_id: str, properties: Dict[str, Any]):
        """Update arbitrary properties on a page."""
        self.client.pages.update(page_id=page_id, properties=properties)

    def set_status(self, page_id: str, status: ContentStatus):
        """Set the Status select property on a page."""
        self.update_page_properties(
            page_id, {"Status": {"select": {"name": status.value}}}
        )

    def add_blocks(self, page_id: str, blocks: List[Dict[str, Any]]):
        """Append content blocks to a page (respects 100-block API limit)."""
        for i in range(0, len(blocks), 100):
            self.client.blocks.children.append(
                block_id=page_id, children=blocks[i : i + 100]
            )
            if i + 100 < len(blocks):
                time.sleep(0.3)
