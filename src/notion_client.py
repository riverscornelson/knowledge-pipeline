"""Notion client: query database, create/update pages, add blocks."""
import time
import logging
from typing import List, Dict, Any, Optional

from notion_client import Client

from .config import NotionConfig
from .models import SourceContent, ContentStatus
from .retry import retry_on_transient

log = logging.getLogger(__name__)


class NotionClient:
    """Simplified Notion client for the knowledge pipeline."""

    def __init__(self, config: NotionConfig):
        self.client = Client(auth=config.token)
        self.db_id = config.sources_db_id

    def hash_exists(self, content_hash: str) -> bool:
        """Check if a content hash already exists in the database.

        Falls back to False if the query fails (e.g. Notion API v2025
        removed databases.query — dedup is best-effort).
        """
        try:
            resp = retry_on_transient(
                self.client.request,
                path=f"databases/{self.db_id}/query",
                method="POST",
                body={"filter": {"property": "Hash", "rich_text": {"equals": content_hash}}},
            )
            return len(resp.get("results", [])) > 0
        except Exception:
            log.debug("hash_exists query failed, assuming not seen")
            return False

    def title_exists(self, title: str) -> bool:
        """Check if a page with this title already exists in the database."""
        try:
            resp = retry_on_transient(
                self.client.search, query=title, page_size=10
            )
            for page in resp.get("results", []):
                if page.get("object") != "page":
                    continue
                parent = page.get("parent", {})
                if parent.get("database_id", "").replace("-", "") != self.db_id.replace("-", ""):
                    continue
                props = page.get("properties", {})
                for prop in props.values():
                    if prop.get("type") == "title":
                        page_title = "".join(
                            t.get("plain_text", "") for t in prop.get("title", [])
                        )
                        if page_title == title:
                            return True
            return False
        except Exception:
            log.debug("title_exists search failed, assuming not seen")
            return False

    def source_file_exists(self, filename: str) -> bool:
        """Check if a page with this Source File property already exists."""
        try:
            resp = retry_on_transient(
                self.client.search, query=filename, page_size=10
            )
            for page in resp.get("results", []):
                if page.get("object") != "page":
                    continue
                parent = page.get("parent", {})
                if parent.get("database_id", "").replace("-", "") != self.db_id.replace("-", ""):
                    continue
                props = page.get("properties", {})
                sf = props.get("Source File", {})
                if sf.get("type") == "rich_text":
                    value = "".join(
                        t.get("plain_text", "") for t in sf.get("rich_text", [])
                    )
                    if value == filename:
                        return True
            return False
        except Exception:
            log.debug("source_file_exists search failed, assuming not seen")
            return False

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

    def search_workspace(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Search the Notion workspace for pages matching a query.

        Returns a list of dicts with page_id, title, and url.
        """
        resp = self.client.search(query=query, page_size=max_results)
        results: List[Dict[str, str]] = []
        for page in resp.get("results", []):
            if page.get("object") != "page":
                continue
            page_id = page["id"]
            url = page.get("url", "")
            # Extract title from properties
            title = ""
            props = page.get("properties", {})
            for prop in props.values():
                if prop.get("type") == "title":
                    title_parts = prop.get("title", [])
                    title = "".join(t.get("plain_text", "") for t in title_parts)
                    break
            results.append({"page_id": page_id, "title": title, "url": url})
        return results[:max_results]

    def fetch_page_content(self, page_id: str, max_chars: int = 4000) -> str:
        """Fetch the plain-text content of a Notion page's blocks.

        Concatenates text from all block types, truncated to max_chars.
        """
        resp = self.client.blocks.children.list(block_id=page_id)
        text_parts: List[str] = []
        total = 0
        for block in resp.get("results", []):
            block_type = block.get("type", "")
            block_data = block.get(block_type, {})
            rich_texts = block_data.get("rich_text", [])
            for rt in rich_texts:
                plain = rt.get("plain_text", "")
                if plain:
                    text_parts.append(plain)
                    total += len(plain)
                    if total >= max_chars:
                        break
            if total >= max_chars:
                break
        content = "\n".join(text_parts)
        return content[:max_chars]
