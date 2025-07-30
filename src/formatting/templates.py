"""
Template system for content-type specific formatting.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type

from .models import EnrichedContent, ContentQuality, ActionPriority

logger = logging.getLogger(__name__)


class ContentTemplate(ABC):
    """
    Base template for content-type specific formatting.
    
    Templates define how different types of content should be formatted,
    including section visibility, ordering, and specific formatting rules.
    """
    
    # Default visibility rules (can be overridden by subclasses)
    DEFAULT_ALWAYS_VISIBLE = [
        "executive_summary",
        "action_items",
        "quality_indicator"
    ]
    
    DEFAULT_QUALITY_THRESHOLDS = {
        "detailed_analysis": 0.7,
        "strategic_implications": 0.7,
        "technical_details": 0.8,
        "raw_content": 0.0,  # Always in toggle
        "processing_metadata": 0.0,  # Always in toggle
    }
    
    @abstractmethod
    def get_template_name(self) -> str:
        """Return the name of this template."""
        pass
    
    @abstractmethod
    def get_supported_content_types(self) -> List[str]:
        """Return list of content types this template supports."""
        pass
    
    def should_show_section(
        self,
        section: str,
        content: EnrichedContent
    ) -> bool:
        """
        Determine if a section should be shown based on quality and content.
        
        Args:
            section: Name of the section
            content: The enriched content
            
        Returns:
            True if section should be visible (not in toggle)
        """
        # Always visible sections
        if section in self.DEFAULT_ALWAYS_VISIBLE:
            return True
        
        # Check quality thresholds
        threshold = self.DEFAULT_QUALITY_THRESHOLDS.get(section, 0.5)
        if content.quality_score >= threshold:
            return True
        
        # Check for critical actions that might override visibility
        if section == "strategic_implications" and content.has_critical_actions():
            return True
        
        return False
    
    @abstractmethod
    def format_section(
        self,
        section: str,
        content: Any,
        enriched_content: EnrichedContent
    ) -> List[Dict[str, Any]]:
        """
        Format a section into Notion blocks.
        
        Args:
            section: Name of the section
            content: The section content
            enriched_content: The full enriched content for context
            
        Returns:
            List of Notion block dictionaries
        """
        pass
    
    @abstractmethod
    def get_section_order(self) -> List[str]:
        """Return the order in which sections should appear."""
        pass
    
    def get_section_icon(self, section: str) -> str:
        """Get icon for a section."""
        icons = {
            "executive_summary": "📋",
            "key_insights": "💡",
            "action_items": "⚡",
            "detailed_analysis": "📊",
            "strategic_implications": "🎯",
            "technical_details": "🔧",
            "methodology": "🔬",
            "market_impact": "📈",
            "competitive_analysis": "🏆",
            "risk_assessment": "⚠️",
            "raw_content": "📄",
            "processing_metadata": "⚙️",
        }
        return icons.get(section, "📌")
    
    def get_quality_indicator(self, content: EnrichedContent) -> Dict[str, Any]:
        """Get quality indicator block."""
        quality_bar = self._create_quality_bar(content.quality_score)
        quality_emoji = self._get_quality_emoji(content.quality_level)
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"{quality_emoji} Quality Score: {quality_bar} ({content.quality_score:.0%})"
                        }
                    }
                ],
                "icon": {"emoji": quality_emoji},
                "color": self._get_quality_color(content.quality_level)
            }
        }
    
    def _create_quality_bar(self, score: float) -> str:
        """Create visual quality bar."""
        filled = int(score * 10)
        empty = 10 - filled
        return "█" * filled + "░" * empty
    
    def _get_quality_emoji(self, quality: ContentQuality) -> str:
        """Get emoji for quality level."""
        return {
            ContentQuality.EXCELLENT: "⭐",
            ContentQuality.HIGH: "✨",
            ContentQuality.MEDIUM: "✓",
            ContentQuality.LOW: "⚠️"
        }.get(quality, "❓")
    
    def _get_quality_color(self, quality: ContentQuality) -> str:
        """Get color for quality level."""
        return {
            ContentQuality.EXCELLENT: "green_background",
            ContentQuality.HIGH: "blue_background",
            ContentQuality.MEDIUM: "yellow_background",
            ContentQuality.LOW: "red_background"
        }.get(quality, "gray_background")
    
    def _get_priority_emoji(self, priority: ActionPriority) -> str:
        """Get emoji for action priority."""
        return {
            ActionPriority.CRITICAL: "🔴",
            ActionPriority.HIGH: "🟡",
            ActionPriority.MEDIUM: "🟢",
            ActionPriority.LOW: "⚪"
        }.get(priority, "❓")


class TemplateRegistry:
    """Registry for content templates."""
    
    _templates: Dict[str, ContentTemplate] = {}
    _content_type_map: Dict[str, str] = {}
    
    @classmethod
    def register(cls, template: ContentTemplate) -> None:
        """Register a template."""
        name = template.get_template_name()
        cls._templates[name] = template
        
        # Map content types to template
        for content_type in template.get_supported_content_types():
            cls._content_type_map[content_type] = name
        
        logger.info(f"Registered template '{name}' for types: {template.get_supported_content_types()}")
    
    @classmethod
    def get_template(cls, content_type: str) -> Optional[ContentTemplate]:
        """Get template for a content type."""
        template_name = cls._content_type_map.get(content_type)
        if not template_name:
            logger.warning(f"No template found for content type '{content_type}'")
            # Return default template if available
            return cls._templates.get("general")
        
        return cls._templates.get(template_name)
    
    @classmethod
    def list_templates(cls) -> List[str]:
        """List all registered template names."""
        return list(cls._templates.keys())
    
    @classmethod
    def list_content_types(cls) -> List[str]:
        """List all supported content types."""
        return list(cls._content_type_map.keys())