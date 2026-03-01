"""Data models for the knowledge pipeline."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional


class ContentStatus(Enum):
    INBOX = "Inbox"
    PROCESSING = "Processing"
    ENRICHED = "Enriched"
    FAILED = "Failed"


@dataclass
class SourceContent:
    """A PDF from Google Drive tracked in Notion."""
    title: str
    hash: str
    status: ContentStatus = ContentStatus.INBOX
    drive_url: Optional[str] = None
    created_date: Optional[datetime] = None

    def to_notion_properties(self) -> Dict[str, Any]:
        props: Dict[str, Any] = {
            "Title": {"title": [{"text": {"content": self.title}}]},
            "Status": {"select": {"name": self.status.value}},
            "Hash": {"rich_text": [{"text": {"content": self.hash}}]},
            "Content-Type": {"select": {"name": "PDF"}},
        }
        if self.drive_url:
            props["Drive URL"] = {"url": self.drive_url}
        if self.created_date:
            props["Created Date"] = {"date": {"start": self.created_date.isoformat()}}
        return props


@dataclass
class EnrichmentResult:
    """Output of AI enrichment for a single document."""
    summary: str
    insights: List[str]
    content_type: str
    ai_primitives: List[str] = field(default_factory=list)
    vendor: Optional[str] = None
    topical_tags: List[str] = field(default_factory=list)
    domain_tags: List[str] = field(default_factory=list)
    client_relevance: List[str] = field(default_factory=list)
