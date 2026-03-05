"""CLI entry point for Notion → RVF knowledge distillation.

Usage:
    python -m src.distill                    # Full export + ingest
    python -m src.distill --query "search"   # Query the RVF store
    python -m src.distill --status           # Show RVF store status
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from .config import NotionConfig
from .rvf_export import (
    FIELD_MAP,
    Chunk,
    NotionPage,
    chunk_page,
    embed_chunks,
    export_database,
    export_standalone_pages,
    ingest_to_rvf,
    query_rvf,
    rvf_status,
    DEFAULT_RVF_PATH,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database registry — which Notion databases to export
# ---------------------------------------------------------------------------

# Populated from env vars; see _load_database_config()
DB_REGISTRY: dict = {}


def _load_database_config() -> dict:
    """Build the database export registry from environment variables."""
    registry: dict = {}

    # Sources database (required — already in env as NOTION_SOURCES_DB)
    sources_db = os.getenv("NOTION_SOURCES_DB", "")
    if sources_db:
        registry["Sources"] = {
            "db_id": sources_db,
            "filter": {
                "property": "Status",
                "select": {"equals": "Enriched"},
            },
        }

    # Knowledge Base (optional)
    kb_db = os.getenv("NOTION_KNOWLEDGE_BASE_DB", "")
    if kb_db:
        registry["Knowledge Base"] = {"db_id": kb_db}

    # Open Brain Captures (optional)
    obc_db = os.getenv("NOTION_OPEN_BRAIN_DB", "")
    if obc_db:
        registry["Open Brain Captures"] = {"db_id": obc_db}

    # Clients database (optional)
    clients_db = os.getenv("NOTION_CLIENTS_DB", "")
    if clients_db:
        registry["Clients"] = {"db_id": clients_db}

    # Activities database (optional)
    activities_db = os.getenv("NOTION_ACTIVITIES_DB", "")
    if activities_db:
        registry["Activities"] = {"db_id": activities_db}

    # Deal Pipeline (optional)
    deals_db = os.getenv("NOTION_DEALS_DB", "")
    if deals_db:
        registry["Deal Pipeline"] = {"db_id": deals_db}

    # Market Research (optional)
    market_db = os.getenv("NOTION_MARKET_RESEARCH_DB", "")
    if market_db:
        registry["Market Research"] = {"db_id": market_db}

    return registry


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def distill(rvf_path: Path = DEFAULT_RVF_PATH) -> None:
    """Full pipeline: export Notion → chunk → embed → ingest into RVF."""
    notion_config = NotionConfig.from_env()
    api_key = os.environ["OPENAI_API_KEY"]
    registry = _load_database_config()

    if not registry:
        log.error("No databases configured. Set NOTION_SOURCES_DB at minimum.")
        sys.exit(1)

    # Delete existing .rvf for clean rebuild
    if rvf_path.exists():
        log.info("Removing existing RVF file for clean rebuild: %s", rvf_path)
        rvf_path.unlink()

    # Phase 1: Export pages from all databases
    all_pages: list[NotionPage] = []
    for db_name, db_conf in registry.items():
        db_id = db_conf["db_id"]
        filter_body = db_conf.get("filter")
        try:
            pages = export_database(notion_config.token, db_id, db_name, filter_body)
            all_pages.extend(pages)
        except Exception:
            log.exception("Failed to export database: %s", db_name)

    # Export public site pages if configured
    public_page_ids = os.getenv("NOTION_PUBLIC_SITE_PAGES", "")
    if public_page_ids:
        ids = [pid.strip() for pid in public_page_ids.split(",") if pid.strip()]
        try:
            site_pages = export_standalone_pages(
                notion_config.token, ids, "Public Site"
            )
            all_pages.extend(site_pages)
        except Exception:
            log.exception("Failed to export public site pages")

    log.info("Total pages exported: %d", len(all_pages))

    if not all_pages:
        log.warning("No pages to process. Check database IDs and filters.")
        return

    # Phase 2: Chunk
    all_chunks: list[Chunk] = []
    for page in all_pages:
        chunks = chunk_page(page)
        all_chunks.extend(chunks)

    log.info("Total chunks: %d", len(all_chunks))

    # Phase 3: Embed
    log.info("Embedding %d chunks with %s...", len(all_chunks), "text-embedding-3-small")
    embedded = embed_chunks(all_chunks, api_key)
    log.info("Embedding complete.")

    # Phase 4: Ingest into RVF
    log.info("Ingesting into RVF: %s", rvf_path)
    result = ingest_to_rvf(embedded, rvf_path)
    log.info(
        "RVF ingest complete: %d accepted, %d rejected, %d total vectors, %d bytes",
        result["accepted"],
        result["rejected"],
        result["totalVectors"],
        result["fileSize"],
    )
    log.info(
        "Witness chain: %d entries, valid=%s",
        result["witnessEntries"],
        result["witnessValid"],
    )


def _load_chunk_index(rvf_path: Path) -> dict:
    """Load text index for result display."""
    index_path = rvf_path.with_suffix(".index.json")
    if not index_path.exists():
        return {}
    with open(index_path) as f:
        return {int(k): v for k, v in json.load(f).items()}


def do_query(query_text: str, rvf_path: Path, k: int = 5) -> None:
    """Query the RVF store and print results."""
    api_key = os.environ["OPENAI_API_KEY"]

    if not rvf_path.exists():
        log.error("RVF file not found: %s. Run distill first.", rvf_path)
        sys.exit(1)

    chunk_index = _load_chunk_index(rvf_path)
    results = query_rvf(query_text, api_key, rvf_path, k=k)

    print(f"\nQuery: {query_text}")
    print(f"Results ({len(results)}):\n")
    for i, r in enumerate(results, 1):
        info = chunk_index.get(r["id"], {})
        title = info.get("title", "Unknown")
        db = info.get("database", "")
        text = info.get("text", "")
        url = info.get("url", "")
        label = f"[{db}] {title}" if db else title
        print(f"--- {i}. {label} ---")
        if url:
            print(f"URL: {url}")
        print(text)
        print()


def do_status(rvf_path: Path) -> None:
    """Print RVF store status."""
    if not rvf_path.exists():
        log.error("RVF file not found: %s", rvf_path)
        sys.exit(1)

    s = rvf_status(rvf_path)
    print(f"\nRVF Store: {rvf_path}")
    print(f"  Vectors:    {s['totalVectors']}")
    print(f"  Dimension:  {s['dimension']}")
    print(f"  Metric:     {s['metric']}")
    print(f"  File size:  {s['fileSize']:,} bytes")
    print(f"  Epoch:      {s['epoch']}")
    print(f"  Compaction: {s['compactionState']}")
    print(f"  Dead space: {s['deadSpaceRatio']:.1%}")
    print(f"  Witness:    {s['witnessEntries']} entries, valid={s['witnessValid']}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Notion → RVF knowledge distillation pipeline"
    )
    parser.add_argument(
        "--query", "-q", type=str, help="Query the RVF store instead of building it"
    )
    parser.add_argument(
        "--status", "-s", action="store_true", help="Show RVF store status"
    )
    parser.add_argument(
        "--rvf-path",
        type=Path,
        default=DEFAULT_RVF_PATH,
        help=f"Path to .rvf file (default: {DEFAULT_RVF_PATH})",
    )
    parser.add_argument(
        "--k", type=int, default=5, help="Number of results for query (default: 5)"
    )

    args = parser.parse_args()

    if args.status:
        do_status(args.rvf_path)
    elif args.query:
        do_query(args.query, args.rvf_path, k=args.k)
    else:
        distill(args.rvf_path)


if __name__ == "__main__":
    main()
