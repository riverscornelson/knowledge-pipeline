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
    PROCESSING = "Processing"
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

    # GPT-5 Processing Metadata
    gpt5_processing_started: Optional[datetime] = None
    gpt5_processing_completed: Optional[datetime] = None
    gpt5_current_stage: Optional[str] = None
    gpt5_retry_count: int = 0
    gpt5_error_count: int = 0
    gpt5_last_error: Optional[str] = None
    gpt5_token_usage: Optional[Dict[str, int]] = None
    gpt5_quality_score: Optional[float] = None
    gpt5_processing_time: Optional[float] = None
    gpt5_model_version: Optional[str] = None
    gpt5_config_used: Optional[str] = None
    
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

        # GPT-5 Processing Properties
        if self.gpt5_processing_started:
            props["GPT5 Started"] = {"date": {"start": self.gpt5_processing_started.isoformat()}}

        if self.gpt5_processing_completed:
            props["GPT5 Completed"] = {"date": {"start": self.gpt5_processing_completed.isoformat()}}

        if self.gpt5_current_stage:
            props["GPT5 Stage"] = {"select": {"name": self.gpt5_current_stage}}

        if self.gpt5_retry_count > 0:
            props["GPT5 Retries"] = {"number": self.gpt5_retry_count}

        if self.gpt5_error_count > 0:
            props["GPT5 Errors"] = {"number": self.gpt5_error_count}

        if self.gpt5_last_error:
            props["GPT5 Last Error"] = {"rich_text": [{"text": {"content": self.gpt5_last_error[:2000]}}]}  # Notion limit

        if self.gpt5_quality_score is not None:
            props["GPT5 Quality Score"] = {"number": self.gpt5_quality_score}

        if self.gpt5_processing_time is not None:
            props["GPT5 Processing Time"] = {"number": self.gpt5_processing_time}

        if self.gpt5_model_version:
            props["GPT5 Model"] = {"select": {"name": self.gpt5_model_version}}

        if self.gpt5_config_used:
            props["GPT5 Config"] = {"select": {"name": self.gpt5_config_used}}

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

    # GPT-5 Enhanced Metadata
    quality_score: Optional[float] = None
    processing_stage: Optional[str] = None
    retry_count: int = 0
    error_details: Optional[Dict[str, Any]] = None
    model_version: Optional[str] = None
    config_version: Optional[str] = None
    notion_blocks_count: Optional[int] = None
    aesthetic_score: Optional[float] = None
    validation_passed: bool = True
    processing_warnings: Optional[List[str]] = None