"""Export Notion pages → chunk → embed → JSON for RVF ingestion."""

import hashlib
import json
import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import OpenAI

from .config import NotionConfig
from .retry import retry_on_transient

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 384
EMBEDDING_BATCH_SIZE = 100

# Stable field-ID mapping for RVF metadata filtering.
# Keys are semantic names; values are the numeric fieldId used by rvf-node.
FIELD_MAP = {
    "database": 0,
    "content_type": 1,
    "vendor": 2,
    "client": 3,
    "knowledge_type": 4,
    "category": 5,
    "page_url": 6,
    "source_page_id": 7,
    "source_page_title": 8,
    "domain_tags": 9,
    "topical_tags": 10,
    "ai_primitive": 11,
}

# Database IDs to export (set via environment or passed in)
DATABASE_CONFIGS: Dict[str, Dict[str, Any]] = {}

RVF_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "rvf_ingest.js"
DEFAULT_RVF_PATH = Path(__file__).resolve().parent.parent / "data" / "notion-knowledge.rvf"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class NotionPage:
    """A page fetched from Notion."""

    page_id: str
    title: str
    url: str
    database_name: str
    body_text: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Chunk:
    """A text chunk ready for embedding."""

    id: int
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Notion export
# ---------------------------------------------------------------------------

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"


def _notion_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
    }


def _query_database_pages(
    token: str, db_id: str, filter_body: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Paginate through a Notion database and return all page objects."""
    import requests

    pages: List[Dict[str, Any]] = []
    cursor: Optional[str] = None
    headers = _notion_headers(token)

    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if filter_body:
            body["filter"] = filter_body
        if cursor:
            body["start_cursor"] = cursor

        resp = retry_on_transient(
            requests.post,
            f"{NOTION_API_BASE}/databases/{db_id}/query",
            headers=headers,
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        pages.extend(data.get("results", []))

        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")

    return pages


def _extract_title(props: Dict[str, Any]) -> str:
    """Extract the title string from page properties."""
    for prop in props.values():
        if prop.get("type") == "title":
            return "".join(t.get("plain_text", "") for t in prop.get("title", []))
    return ""


def _extract_select(props: Dict[str, Any], name: str) -> str:
    p = props.get(name, {})
    sel = p.get("select")
    if sel and isinstance(sel, dict):
        return sel.get("name", "")
    return ""


def _extract_multi_select(props: Dict[str, Any], name: str) -> List[str]:
    p = props.get(name, {})
    ms = p.get("multi_select", [])
    return [item.get("name", "") for item in ms if item.get("name")]


def _extract_rich_text(props: Dict[str, Any], name: str) -> str:
    p = props.get(name, {})
    return "".join(t.get("plain_text", "") for t in p.get("rich_text", []))


def _fetch_page_blocks(token: str, page_id: str, max_chars: int = 8000) -> str:
    """Fetch block content for a page as plain text."""
    import requests

    headers = _notion_headers(token)
    text_parts: List[str] = []
    total = 0
    cursor: Optional[str] = None

    while total < max_chars:
        url = f"{NOTION_API_BASE}/blocks/{page_id}/children"
        params: Dict[str, Any] = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor

        resp = retry_on_transient(
            requests.get, url, headers=headers, params=params, timeout=60
        )
        resp.raise_for_status()
        data = resp.json()

        for block in data.get("results", []):
            block_type = block.get("type", "")
            block_data = block.get(block_type, {})
            rich_texts = block_data.get("rich_text", [])
            for rt in rich_texts:
                plain = rt.get("plain_text", "")
                if plain:
                    text_parts.append(plain)
                    total += len(plain)

        if not data.get("has_more") or total >= max_chars:
            break
        cursor = data.get("next_cursor")

    return "\n".join(text_parts)[:max_chars]


def export_database(
    token: str,
    db_id: str,
    db_name: str,
    filter_body: Optional[Dict[str, Any]] = None,
) -> List[NotionPage]:
    """Export all pages from a Notion database."""
    import time as _time

    log.info("Exporting database: %s (%s)", db_name, db_id)
    raw_pages = _query_database_pages(token, db_id, filter_body)
    total = len(raw_pages)
    log.info("  Found %d pages", total)

    pages: List[NotionPage] = []
    skipped = 0
    for idx, rp in enumerate(raw_pages):
        props = rp.get("properties", {})
        title = _extract_title(props)
        if not title:
            continue

        page_id = rp["id"]
        url = rp.get("url", "")

        try:
            body = _fetch_page_blocks(token, page_id)
        except Exception:
            log.warning("  Skipping page %d/%d (fetch failed): %s", idx + 1, total, title)
            skipped += 1
            _time.sleep(1)
            continue

        if not body.strip():
            continue

        pages.append(
            NotionPage(
                page_id=page_id,
                title=title,
                url=url,
                database_name=db_name,
                body_text=body,
                properties=props,
            )
        )

        if (idx + 1) % 100 == 0:
            log.info("  Progress: %d/%d pages fetched (%d skipped)", idx + 1, total, skipped)

    log.info("  Exported %d pages with content (%d skipped)", len(pages), skipped)
    return pages


def export_standalone_pages(
    token: str, page_ids: List[str], db_name: str
) -> List[NotionPage]:
    """Export standalone pages (not in a database) by page ID."""
    import requests

    pages: List[NotionPage] = []
    headers = _notion_headers(token)

    for page_id in page_ids:
        try:
            resp = retry_on_transient(
                requests.get,
                f"{NOTION_API_BASE}/pages/{page_id}",
                headers=headers,
                timeout=60,
            )
            resp.raise_for_status()
            rp = resp.json()
            props = rp.get("properties", {})
            title = _extract_title(props)
            url = rp.get("url", "")
            body = _fetch_page_blocks(token, page_id)
            if title and body.strip():
                pages.append(
                    NotionPage(
                        page_id=page_id,
                        title=title,
                        url=url,
                        database_name=db_name,
                        body_text=body,
                        properties=props,
                    )
                )
        except Exception:
            log.warning("Failed to export page %s", page_id)

    return pages


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def chunk_page(page: NotionPage, max_tokens: int = 500) -> List[Chunk]:
    """Split a page into chunks. Short pages become a single chunk."""
    # Prepend title for retrieval context
    full_text = f"{page.title}\n\n{page.body_text}"

    # Extract metadata from properties
    props = page.properties
    meta: Dict[str, Any] = {
        str(FIELD_MAP["database"]): page.database_name,
        str(FIELD_MAP["page_url"]): page.url,
        str(FIELD_MAP["source_page_id"]): page.page_id,
        str(FIELD_MAP["source_page_title"]): page.title,
    }

    # Source-database-specific metadata
    ct = _extract_select(props, "Content-Type")
    if ct:
        meta[str(FIELD_MAP["content_type"])] = ct

    vendor = _extract_select(props, "Vendor")
    if vendor:
        meta[str(FIELD_MAP["vendor"])] = vendor

    ai_prims = _extract_multi_select(props, "AI-Primitive")
    if ai_prims:
        meta[str(FIELD_MAP["ai_primitive"])] = ", ".join(ai_prims)

    topical = _extract_multi_select(props, "Topical-Tags")
    if topical:
        meta[str(FIELD_MAP["topical_tags"])] = ", ".join(topical)

    domain = _extract_multi_select(props, "Domain-Tags")
    if domain:
        meta[str(FIELD_MAP["domain_tags"])] = ", ".join(domain)

    client_rel = _extract_rich_text(props, "Client-Relevance")
    if client_rel:
        meta[str(FIELD_MAP["client"])] = client_rel

    # Knowledge Base-specific
    kt = _extract_select(props, "Knowledge Type")
    if kt:
        meta[str(FIELD_MAP["knowledge_type"])] = kt

    # Open Brain Captures
    cat = _extract_select(props, "Category")
    if cat:
        meta[str(FIELD_MAP["category"])] = cat

    # Estimate tokens (rough: 1 token ≈ 4 chars)
    est_tokens = len(full_text) / 4

    if est_tokens <= max_tokens:
        # Single chunk
        chunk_id = int(
            hashlib.sha256(page.page_id.encode()).hexdigest()[:8], 16
        )
        return [Chunk(id=chunk_id, text=full_text, metadata=meta)]

    # Split by headings or fixed windows
    sections = _split_by_headings(full_text)
    chunks: List[Chunk] = []
    for i, section_text in enumerate(sections):
        chunk_id = int(
            hashlib.sha256(f"{page.page_id}:{i}".encode()).hexdigest()[:8], 16
        )
        chunks.append(Chunk(id=chunk_id, text=section_text, metadata=meta))

    return chunks


def _split_by_headings(text: str, max_chars: int = 2000) -> List[str]:
    """Split text at heading boundaries, with fallback to fixed windows."""
    lines = text.split("\n")
    sections: List[str] = []
    current: List[str] = []

    for line in lines:
        # Detect heading-like lines (markdown ## or bold standalone lines)
        is_heading = line.startswith("## ") or line.startswith("### ")
        if is_heading and current:
            sections.append("\n".join(current))
            current = []
        current.append(line)

    if current:
        sections.append("\n".join(current))

    # Merge small sections, split large ones
    merged: List[str] = []
    buffer = ""
    for section in sections:
        if len(buffer) + len(section) < max_chars:
            buffer = buffer + "\n" + section if buffer else section
        else:
            if buffer:
                merged.append(buffer)
            # Split oversized sections into windows
            if len(section) > max_chars:
                for j in range(0, len(section), max_chars - 200):
                    merged.append(section[j : j + max_chars])
            else:
                buffer = section
                continue
            buffer = ""
    if buffer:
        merged.append(buffer)

    return merged if merged else [text[:max_chars]]


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------


def embed_chunks(
    chunks: List[Chunk], api_key: str
) -> List[Dict[str, Any]]:
    """Embed chunk texts via OpenAI and return dicts ready for RVF ingest."""
    client = OpenAI(api_key=api_key)
    embedded: List[Dict[str, Any]] = []

    for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch = chunks[i : i + EMBEDDING_BATCH_SIZE]
        texts = [c.text for c in batch]

        resp = retry_on_transient(
            client.embeddings.create,
            input=texts,
            model=EMBEDDING_MODEL,
            dimensions=EMBEDDING_DIMS,
        )

        for chunk, item in zip(batch, resp.data):
            embedded.append(
                {
                    "id": chunk.id,
                    "vector": item.embedding,
                    "metadata": chunk.metadata,
                    "text": chunk.text,
                }
            )

    return embedded


# ---------------------------------------------------------------------------
# RVF interaction (calls Node.js script)
# ---------------------------------------------------------------------------


def _run_rvf_script(command: str, args: List[str]) -> Dict[str, Any]:
    """Run the rvf_ingest.js Node.js script and return parsed JSON output."""
    cmd = ["node", str(RVF_SCRIPT), command] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        raise RuntimeError(f"rvf_ingest.js {command} failed: {result.stderr}")

    return json.loads(result.stdout)


def ingest_to_rvf(
    embedded_chunks: List[Dict[str, Any]],
    rvf_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Write embedded chunks to a .rvf file via Node.js."""
    rvf_path = rvf_path or DEFAULT_RVF_PATH
    rvf_path.parent.mkdir(parents=True, exist_ok=True)

    # Save embedded chunks (with vectors) for potential re-ingest
    cache_path = rvf_path.with_suffix(".chunks.json")
    with open(cache_path, "w") as f:
        json.dump(embedded_chunks, f)
    log.info("Saved %d embedded chunks to %s", len(embedded_chunks), cache_path)

    # Save lightweight text index (no vectors) for query result display
    index_path = rvf_path.with_suffix(".index.json")
    text_index = {
        str(c["id"]): {
            "title": c.get("metadata", {}).get(str(FIELD_MAP["source_page_title"]), ""),
            "database": c.get("metadata", {}).get(str(FIELD_MAP["database"]), ""),
            "text": c.get("text", ""),
            "url": c.get("metadata", {}).get(str(FIELD_MAP["page_url"]), ""),
        }
        for c in embedded_chunks
    }
    with open(index_path, "w") as f:
        json.dump(text_index, f)
    log.info("Saved text index to %s", index_path)

    result = _run_rvf_script("ingest", [str(rvf_path), str(cache_path)])
    return result


def query_rvf(
    query_text: str,
    api_key: str,
    rvf_path: Optional[Path] = None,
    k: int = 5,
    filter_expr: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Embed a query and search the RVF store."""
    rvf_path = rvf_path or DEFAULT_RVF_PATH

    client = OpenAI(api_key=api_key)
    resp = client.embeddings.create(
        input=[query_text], model=EMBEDDING_MODEL, dimensions=EMBEDDING_DIMS
    )
    vector = resp.data[0].embedding

    query_data: Dict[str, Any] = {"vector": vector, "k": k}
    if filter_expr:
        query_data["filter"] = filter_expr

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(query_data, f)
        query_path = f.name

    try:
        result = _run_rvf_script("query", [str(rvf_path), query_path])
    finally:
        os.unlink(query_path)

    return result.get("results", [])


def rvf_status(rvf_path: Optional[Path] = None) -> Dict[str, Any]:
    """Get status of the RVF store."""
    rvf_path = rvf_path or DEFAULT_RVF_PATH
    return _run_rvf_script("status", [str(rvf_path)])
