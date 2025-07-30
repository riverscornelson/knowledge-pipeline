"""
Content models for the formatting system.

These models provide a normalized structure for enriched content that is
independent of the specific prompt outputs.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ActionPriority(Enum):
    """Priority levels for action items."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ContentQuality(Enum):
    """Quality levels for content."""
    EXCELLENT = "excellent"  # > 0.9
    HIGH = "high"           # 0.7 - 0.9
    MEDIUM = "medium"       # 0.5 - 0.7
    LOW = "low"             # < 0.5


@dataclass
class Insight:
    """A key insight extracted from content."""
    text: str
    confidence: float = 1.0
    supporting_evidence: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class ActionItem:
    """An actionable item extracted from content."""
    text: str
    priority: ActionPriority
    due_date: Optional[datetime] = None
    assignee: Optional[str] = None
    context: Optional[str] = None


@dataclass
class Attribution:
    """Attribution information for processed content."""
    prompt_name: str
    prompt_version: str
    prompt_source: str  # "notion" or "yaml"
    analyzer_name: str
    analyzer_version: str
    model_used: str
    processing_timestamp: datetime


@dataclass
class ProcessingMetrics:
    """Metrics from content processing."""
    processing_time_seconds: float
    tokens_used: int
    estimated_cost: float
    quality_score: float
    confidence_score: float
    cache_hit: bool = False
    error_count: int = 0


@dataclass
class EnrichedContent:
    """
    Normalized content model independent of prompt structure.
    
    This model provides a consistent interface for formatted content regardless
    of the specific prompts used or their output structure.
    """
    # Content identification
    content_type: str
    source_id: str
    source_title: str
    
    # Quality indicators
    quality_score: float
    quality_level: ContentQuality
    
    # Core sections (always present, may be empty)
    executive_summary: List[str]  # Top 3-5 bullet points
    key_insights: List[Insight]
    action_items: List[ActionItem]
    
    # Metadata (required fields)
    attribution: Attribution
    processing_metrics: ProcessingMetrics
    
    # Optional sections (prompt-dependent)
    raw_sections: Dict[str, Any] = field(default_factory=dict)
    
    # Original content reference
    raw_content: Optional[str] = None
    raw_content_size_bytes: int = 0
    
    # Additional properties from Notion
    tags: List[str] = field(default_factory=list)
    url: Optional[str] = None
    
    def get_section(self, section_name: str) -> Optional[Any]:
        """Get a section by name, checking both core and raw sections."""
        # Check core sections first
        if hasattr(self, section_name):
            return getattr(self, section_name)
        # Fall back to raw sections
        return self.raw_sections.get(section_name)
    
    def has_critical_actions(self) -> bool:
        """Check if content has critical action items."""
        return any(
            action.priority == ActionPriority.CRITICAL 
            for action in self.action_items
        )
    
    def has_high_priority_actions(self) -> bool:
        """Check if content has high or critical priority action items."""
        return any(
            action.priority in (ActionPriority.CRITICAL, ActionPriority.HIGH)
            for action in self.action_items
        )
    
    @classmethod
    def calculate_quality_level(cls, score: float) -> ContentQuality:
        """Calculate quality level from numeric score."""
        if score >= 0.9:
            return ContentQuality.EXCELLENT
        elif score >= 0.7:
            return ContentQuality.HIGH
        elif score >= 0.5:
            return ContentQuality.MEDIUM
        else:
            return ContentQuality.LOW