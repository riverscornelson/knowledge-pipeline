"""
Data models and schemas for the knowledge pipeline.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ContentStatus(Enum):
    """Status of content in the pipeline."""
    INBOX = "Inbox"
    ENRICHED = "Enriched"
    FAILED = "Failed"


class ContentType(Enum):
    """Types of content sources."""
    PDF = "PDF"
    WEBSITE = "Website"
    EMAIL = "Email"


@dataclass
class SourceContent:
    """Represents a content item in the pipeline."""
    title: str
    status: ContentStatus
    hash: str
    content_type: Optional[ContentType] = None
    drive_url: Optional[str] = None
    article_url: Optional[str] = None
    created_date: Optional[datetime] = None
    raw_content: Optional[str] = None
    vendor: Optional[str] = None
    ai_primitives: Optional[List[str]] = None
    notion_page_id: Optional[str] = None
    
    def to_notion_properties(self) -> Dict[str, Any]:
        """Convert to Notion properties format."""
        props = {
            "Title": {"title": [{"text": {"content": self.title}}]},
            "Status": {"select": {"name": self.status.value}},
            "Hash": {"rich_text": [{"text": {"content": self.hash}}]},
        }
        
        if self.drive_url:
            props["Drive URL"] = {"url": self.drive_url}
        
        if self.article_url:
            props["Article URL"] = {"url": self.article_url}
        
        if self.created_date:
            props["Created Date"] = {"date": {"start": self.created_date.isoformat()}}
        
        if self.vendor:
            props["Vendor"] = {"select": {"name": self.vendor}}
        
        if self.content_type:
            props["Content-Type"] = {"select": {"name": self.content_type.value}}
        
        if self.ai_primitives:
            props["AI-Primitive"] = {"multi_select": [{"name": p} for p in self.ai_primitives]}
        
        return props


@dataclass
class EnrichmentResult:
    """Result of AI enrichment processing."""
    core_summary: str
    key_insights: List[str]
    content_type: str
    ai_primitives: List[str]
    vendor: Optional[str]
    confidence_scores: Dict[str, float]
    processing_time: float
    token_usage: Dict[str, int]