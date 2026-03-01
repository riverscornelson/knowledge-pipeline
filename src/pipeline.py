"""Main pipeline: Drive PDFs -> AI enrichment -> Notion pages."""
import logging
from datetime import datetime
from typing import Dict

from .config import PipelineConfig
from .drive_client import DriveClient
from .enrichment import enrich
from .formatter import format_blocks
from .models import ContentStatus, SourceContent
from .notion_client import NotionClient

log = logging.getLogger(__name__)


class Pipeline:
    """Ingest PDFs from Google Drive, enrich with AI, store in Notion."""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.drive = DriveClient(config.drive)
        self.notion = NotionClient(config.notion)

    def run(self) -> Dict[str, int]:
        """Process all new PDFs. Returns stats dict."""
        stats = {"total": 0, "processed": 0, "skipped": 0, "failed": 0}

        files = self.drive.list_pdfs()
        stats["total"] = len(files)
        print(f"Found {len(files)} PDFs in Drive folder")

        for f in files:
            file_id = f["id"]
            name = f["name"]

            try:
                # Download and hash for dedup
                pdf_bytes = self.drive.download_pdf(file_id)
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
                page_id = self.notion.create_page(source)

                # Enrich
                result = enrich(text, self.config.openai)
                if not result:
                    self.notion.set_status(page_id, ContentStatus.FAILED)
                    stats["failed"] += 1
                    print(f"  fail (enrich): {name}")
                    continue

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
                if props:
                    self.notion.update_page_properties(page_id, props)

                # Add formatted blocks
                blocks = format_blocks(result)
                self.notion.add_blocks(page_id, blocks)

                # Mark enriched
                self.notion.set_status(page_id, ContentStatus.ENRICHED)
                stats["processed"] += 1
                print(f"  done: {name}")

            except Exception as e:
                stats["failed"] += 1
                log.exception("Error processing %s", name)
                print(f"  error: {name} — {e}")

        print(
            f"\nDone: {stats['processed']} processed, "
            f"{stats['skipped']} skipped, {stats['failed']} failed "
            f"out of {stats['total']} total"
        )
        return stats
