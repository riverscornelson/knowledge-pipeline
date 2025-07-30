"""
Progressive disclosure engine for intelligent section visibility.
"""

from typing import Dict, List, Set

from .models import ActionPriority, ContentQuality, EnrichedContent


class VisibilityRules:
    """
    Intelligent section visibility based on content characteristics.
    
    This engine determines which sections should be immediately visible
    versus hidden in toggles based on quality, urgency, and user needs.
    """
    
    # Sections that are always visible
    ALWAYS_VISIBLE = {
        "quality_indicator",
        "executive_summary",
        "action_items",  # Only if high priority items exist
    }
    
    # Quality thresholds for section visibility
    QUALITY_THRESHOLDS = {
        # High quality content gets more visible sections
        "key_insights": 0.6,
        "detailed_analysis": 0.7,
        "strategic_implications": 0.7,
        "technical_details": 0.8,
        "methodology": 0.8,
        "market_impact": 0.7,
        "competitive_analysis": 0.7,
        "risk_assessment": 0.6,
        
        # These are always in toggles
        "raw_content": 0.0,
        "processing_metadata": 0.0,
        "attribution": 0.0,
        "sources": 0.0,
    }
    
    # Urgency overrides - sections to show when urgent actions exist
    URGENCY_OVERRIDES = {
        ActionPriority.CRITICAL: {
            "action_items",
            "risk_assessment",
            "strategic_implications",
            "timeline",
        },
        ActionPriority.HIGH: {
            "action_items",
            "key_insights",
            "timeline",
        },
    }
    
    # Content type specific rules
    CONTENT_TYPE_RULES = {
        "research_paper": {
            "always_show": {"methodology", "key_findings"},
            "never_show": {"market_impact"},
        },
        "market_news": {
            "always_show": {"market_impact", "timeline"},
            "never_show": {"methodology", "technical_details"},
        },
        "vendor_analysis": {
            "always_show": {"competitive_analysis", "pricing_implications"},
            "never_show": {"methodology"},
        },
    }
    
    @classmethod
    def should_show_section(
        cls,
        section: str,
        content: EnrichedContent,
        force_minimal: bool = False
    ) -> bool:
        """
        Determine if a section should be immediately visible.
        
        Args:
            section: Name of the section
            content: The enriched content
            force_minimal: If True, only show absolute essentials
            
        Returns:
            True if section should be visible (not in toggle)
        """
        # In minimal mode, only show essentials
        if force_minimal:
            return section in {"quality_indicator", "executive_summary"}
        
        # Always visible sections
        if section in cls.ALWAYS_VISIBLE:
            # Special case: action_items only visible if high priority exists
            if section == "action_items":
                return content.has_high_priority_actions()
            return True
        
        # Check content type specific rules
        type_rules = cls.CONTENT_TYPE_RULES.get(content.content_type, {})
        if section in type_rules.get("always_show", set()):
            return True
        if section in type_rules.get("never_show", set()):
            return False
        
        # Check urgency overrides
        if content.has_critical_actions():
            if section in cls.URGENCY_OVERRIDES[ActionPriority.CRITICAL]:
                return True
        elif content.has_high_priority_actions():
            if section in cls.URGENCY_OVERRIDES[ActionPriority.HIGH]:
                return True
        
        # Check quality thresholds
        threshold = cls.QUALITY_THRESHOLDS.get(section, 0.5)
        return content.quality_score >= threshold
    
    @classmethod
    def get_visible_sections(
        cls,
        content: EnrichedContent,
        available_sections: List[str],
        force_minimal: bool = False
    ) -> Set[str]:
        """
        Get set of sections that should be visible for given content.
        
        Args:
            content: The enriched content
            available_sections: List of all available sections
            force_minimal: If True, only show absolute essentials
            
        Returns:
            Set of section names that should be visible
        """
        visible = set()
        
        for section in available_sections:
            if cls.should_show_section(section, content, force_minimal):
                visible.add(section)
        
        return visible
    
    @classmethod
    def get_toggle_sections(
        cls,
        content: EnrichedContent,
        available_sections: List[str],
        force_minimal: bool = False
    ) -> Set[str]:
        """
        Get set of sections that should be in toggles.
        
        Args:
            content: The enriched content
            available_sections: List of all available sections
            force_minimal: If True, more sections go into toggles
            
        Returns:
            Set of section names that should be in toggles
        """
        visible = cls.get_visible_sections(content, available_sections, force_minimal)
        return set(available_sections) - visible
    
    @classmethod
    def get_section_priority(cls, section: str) -> int:
        """
        Get display priority for a section (lower number = higher priority).
        
        Args:
            section: Name of the section
            
        Returns:
            Priority number (0 = highest)
        """
        priority_order = [
            "quality_indicator",
            "executive_summary",
            "action_items",
            "key_insights",
            "market_impact",
            "risk_assessment",
            "strategic_implications",
            "competitive_analysis",
            "detailed_analysis",
            "timeline",
            "methodology",
            "technical_details",
            "pricing_implications",
            "sources",
            "attribution",
            "raw_content",
            "processing_metadata",
        ]
        
        try:
            return priority_order.index(section)
        except ValueError:
            # Unknown sections go in the middle
            return len(priority_order) // 2
    
    @classmethod
    def should_use_callout(
        cls,
        section: str,
        content: EnrichedContent
    ) -> bool:
        """
        Determine if a section should use callout formatting.
        
        Args:
            section: Name of the section
            content: The enriched content
            
        Returns:
            True if section should use callout block
        """
        # High priority sections use callouts
        callout_sections = {
            "quality_indicator",
            "action_items",  # When critical/high priority
            "risk_assessment",
            "market_impact",
        }
        
        if section in callout_sections:
            if section == "action_items":
                return content.has_high_priority_actions()
            return True
        
        # High quality content can use more callouts
        if content.quality_level in (ContentQuality.EXCELLENT, ContentQuality.HIGH):
            if section in {"key_insights", "strategic_implications"}:
                return True
        
        return False