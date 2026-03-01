"""Main pipeline: Drive PDFs -> AI enrichment -> Notion pages."""
import logging
import re
import time
from datetime import datetime
from typing import Dict, List, Any

from .config import PipelineConfig
from .drive_client import DriveClient
from .enrichment import enrich
from .formatter import format_blocks
from .models import ContentStatus, SourceContent
from .notion_client import NotionClient
from .retry import retry_on_transient

log = logging.getLogger(__name__)


class Pipeline:
    """Ingest PDFs from Google Drive, enrich with AI, store in Notion."""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.drive = DriveClient(config.drive)
        self.notion = NotionClient(config.notion)

    @staticmethod
    def _is_duplicate(name: str) -> bool:
        """Return True if filename looks like a Drive upload duplicate, e.g. 'doc (1).pdf'."""
        return bool(re.search(r"\(\d+\)\.pdf$", name))

    @staticmethod
    def _file_size_mb(f: Dict[str, Any]) -> str:
        """Format file size as a human-readable MB string."""
        size = int(f.get("size", 0))
        return f"{size / 1_048_576:.1f} MB"

    def run(self) -> Dict[str, int]:
        """Process all new PDFs. Returns stats dict."""
        start_time = time.monotonic()
        stats = {"total": 0, "processed": 0, "skipped": 0, "failed": 0}

        files: List[Dict[str, Any]] = self.drive.list_pdfs()

        # Filter out Drive upload duplicates like "doc (1).pdf"
        before = len(files)
        files = [f for f in files if not self._is_duplicate(f["name"])]
        dupes_removed = before - len(files)
        if dupes_removed:
            print(f"Filtered {dupes_removed} duplicate upload(s)")

        # Sort by file size (smallest first)
        files.sort(key=lambda f: int(f.get("size", 0)))

        stats["total"] = len(files)
        print(f"Found {len(files)} PDFs in Drive folder")

        for idx, f in enumerate(files, 1):
            file_id = f["id"]
            name = f["name"]
            size_str = self._file_size_mb(f)
            print(f"[{idx}/{len(files)}] {name} ({size_str})")

            try:
                # Title-based dedup (before downloading)
                if self.notion.title_exists(name):
                    stats["skipped"] += 1
                    print(f"  skip (exists): {name}")
                    continue

                # Download and hash for dedup
                pdf_bytes = retry_on_transient(self.drive.download_pdf, file_id)
                content_hash = DriveClient.content_hash(pdf_bytes)

                if self.notion.hash_exists(content_hash):
                    stats["skipped"] += 1
                    print(f"  skip (dup): {name}")
                    continue

                # Extract text
                text = DriveClient.extract_text(pdf_bytes)
                if not text:
                    stats["failed"] += 1
                    print(f"  fail (no text): {name}")
                    continue

                # Create Notion page as Processing
                created = None
                if f.get("createdTime"):
                    try:
                        created = datetime.fromisoformat(
                            f["createdTime"].replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                source = SourceContent(
                    title=name,
                    hash=content_hash,
                    status=ContentStatus.PROCESSING,
                    drive_url=f.get("webViewLink"),
                    created_date=created,
                )
                page_id = retry_on_transient(self.notion.create_page, source)

                # Enrich (pass notion client for agentic tool-use)
                result = enrich(text, self.config.openai, notion=self.notion)
                if not result:
                    retry_on_transient(
                        self.notion.set_status, page_id, ContentStatus.FAILED
                    )
                    stats["failed"] += 1
                    print(f"  fail (enrich): {name}")
                    continue

                # Override Created Date with AI-inferred date if available
                if result.created_date:
                    try:
                        ai_date = datetime.fromisoformat(result.created_date)
                        retry_on_transient(
                            self.notion.update_page_properties,
                            page_id,
                            {"Created Date": {"date": {"start": ai_date.date().isoformat()}}},
                        )
                    except ValueError:
                        log.warning("Invalid created_date from enrichment: %s", result.created_date)

                # Update properties with enrichment data
                props: dict = {}
                if result.content_type:
                    props["Content-Type"] = {"select": {"name": result.content_type}}
                if result.ai_primitives:
                    props["AI-Primitive"] = {
                        "multi_select": [{"name": t} for t in result.ai_primitives]
                    }
                if result.vendor:
                    props["Vendor"] = {"select": {"name": result.vendor}}
                if result.topical_tags:
                    props["Topical-Tags"] = {
                        "multi_select": [{"name": t} for t in result.topical_tags]
                    }
                if result.domain_tags:
                    props["Domain-Tags"] = {
                        "multi_select": [{"name": t} for t in result.domain_tags]
                    }
                if result.client_relevance:
                    props["Client-Relevance"] = {
                        "rich_text": [
                            {"text": {"content": "; ".join(result.client_relevance)[:2000]}}
                        ]
                    }
                if props:
                    retry_on_transient(
                        self.notion.update_page_properties, page_id, props
                    )

                # Add formatted blocks
                blocks = format_blocks(result)
                retry_on_transient(self.notion.add_blocks, page_id, blocks)

                # Mark enriched
                retry_on_transient(
                    self.notion.set_status, page_id, ContentStatus.ENRICHED
                )
                stats["processed"] += 1
                print(f"  done: {name}")

            except Exception as e:
                stats["failed"] += 1
                log.exception("Error processing %s", name)
                print(f"  error: {name} — {e}")

        elapsed = (time.monotonic() - start_time) / 60
        print(
            f"\nDone: {stats['processed']} processed, "
            f"{stats['skipped']} skipped, {stats['failed']} failed "
            f"out of {stats['total']} total ({elapsed:.1f} min)"
        )
        return stats
