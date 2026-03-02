"""Notion client: query database, create/update pages, add blocks."""
import time
import logging
from typing import List, Dict, Any, Optional

import requests as _requests
from notion_client import Client

from .config import NotionConfig
from .models import SourceContent, ContentStatus
from .retry import retry_on_transient

log = logging.getLogger(__name__)

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"


class NotionClient:
    """Simplified Notion client for the knowledge pipeline."""

    def __init__(self, config: NotionConfig):
        self.client = Client(auth=config.token)
        self._token = config.token
        self.db_id = config.sources_db_id
        self.clients_db_id = config.clients_db_id

    def _query_database(self, db_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """Query a Notion database via direct HTTP (SDK v3 removed databases.query)."""
        resp = _requests.post(
            f"{NOTION_API_BASE}/databases/{db_id}/query",
            headers={
                "Authorization": f"Bearer {self._token}",
                "Notion-Version": NOTION_API_VERSION,
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def hash_exists(self, content_hash: str) -> bool:
        """Check if a content hash already exists in the database."""
        try:
            resp = retry_on_transient(
                self._query_database,
                self.db_id,
                {"filter": {"property": "Hash", "rich_text": {"equals": content_hash}}, "page_size": 1},
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

    def load_existing_source_files(self) -> set:
        """Load all Source File values from the database in one pass.

        Returns a set of filenames for fast in-memory dedup.
        Uses pagination to handle large databases.
        """
        source_files: set = set()
        start_cursor = None
        try:
            while True:
                body: Dict[str, Any] = {
                    "filter": {
                        "property": "Source File",
                        "rich_text": {"is_not_empty": True},
                    },
                    "page_size": 100,
                }
                if start_cursor:
                    body["start_cursor"] = start_cursor
                resp = retry_on_transient(
                    self._query_database, self.db_id, body
                )
                for page in resp.get("results", []):
                    props = page.get("properties", {})
                    sf = props.get("Source File", {})
                    val = "".join(
                        t.get("plain_text", "")
                        for t in sf.get("rich_text", [])
                    )
                    if val:
                        source_files.add(val)
                if not resp.get("has_more"):
                    break
                start_cursor = resp.get("next_cursor")
        except Exception:
            log.warning("load_existing_source_files failed, returning partial set")
        return source_files

    def source_file_exists(self, filename: str) -> bool:
        """Check if a page with this Source File property already exists."""
        try:
            resp = retry_on_transient(
                self._query_database,
                self.db_id,
                {
                    "filter": {
                        "property": "Source File",
                        "rich_text": {"equals": filename},
                    },
                    "page_size": 1,
                },
            )
            return len(resp.get("results", [])) > 0
        except Exception:
            log.debug("source_file_exists query failed, assuming not seen")
            return False

    def list_clients(self) -> List[Dict[str, Any]]:
        """List all client records from the Clients Database.

        Returns a list of dicts with company, industry, status, notes, page_id.
        Falls back to empty list if the query fails or clients_db_id is not set.
        """
        if not self.clients_db_id:
            return []
        try:
            resp = retry_on_transient(
                self._query_database,
                self.clients_db_id,
                {},
            )
            clients: List[Dict[str, Any]] = []
            for page in resp.get("results", []):
                props = page.get("properties", {})
                company = "".join(
                    t.get("plain_text", "")
                    for t in self._title_texts(props)
                )
                industry = self._select_value(props.get("Industry", {}))
                status = self._select_value(props.get("Status", {}))
                notes = "".join(
                    t.get("plain_text", "")
                    for t in props.get("Notes", {}).get("rich_text", [])
                )
                clients.append({
                    "company": company,
                    "industry": industry,
                    "status": status,
                    "notes": notes,
                    "page_id": page["id"],
                })
            return clients
        except Exception:
            log.debug("list_clients query failed, returning empty list")
            return []

    @staticmethod
    def _title_texts(props: Dict[str, Any]) -> list:
        """Extract title rich_text array from properties."""
        for prop in props.values():
            if prop.get("type") == "title":
                return prop.get("title", [])
        return []

    @staticmethod
    def _select_value(prop: Dict[str, Any]) -> str:
        """Extract a select property's name, or empty string."""
        sel = prop.get("select")
        if sel and isinstance(sel, dict):
            return sel.get("name", "")
        return ""

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
