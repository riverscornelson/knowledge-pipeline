"""
Adaptive block builder for platform-aware Notion block generation.
"""

import logging
from enum import Enum
from typing import Any, Dict, List, Optional

from .models import ActionItem, EnrichedContent, Insight
from .templates import ContentTemplate
from .visibility import VisibilityRules

logger = logging.getLogger(__name__)


class Platform(Enum):
    """Target platform for formatting."""
    DESKTOP = "desktop"
    MOBILE = "mobile"
    TABLET = "tablet"


class AdaptiveBlockBuilder:
    """
    Platform-aware block generation with smart formatting.
    
    This builder creates Notion blocks optimized for different platforms
    and viewing contexts, using progressive disclosure and visual hierarchy.
    """
    
    # Platform-specific settings
    PLATFORM_SETTINGS = {
        Platform.DESKTOP: {
            "max_line_length": 120,
            "use_columns": True,
            "use_tables": True,
            "callout_style": "full",
        },
        Platform.MOBILE: {
            "max_line_length": 40,
            "use_columns": False,
            "use_tables": False,  # Convert to cards
            "callout_style": "compact",
        },
        Platform.TABLET: {
            "max_line_length": 80,
            "use_columns": True,
            "use_tables": True,
            "callout_style": "full",
        },
    }
    
    def __init__(self, platform: Platform = Platform.DESKTOP):
        """Initialize builder with target platform."""
        self.platform = platform
        self.settings = self.PLATFORM_SETTINGS[platform]
    
    def build_blocks(
        self,
        content: EnrichedContent,
        template: ContentTemplate,
        force_minimal: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Generate formatted blocks based on content, template, and platform.
        
        Args:
            content: The enriched content to format
            template: The template to use for formatting
            force_minimal: If True, use minimal formatting
            
        Returns:
            List of Notion block dictionaries
        """
        blocks = []
        
        # Add quality indicator at the top
        blocks.append(template.get_quality_indicator(content))
        
        # Get sections in order
        section_order = template.get_section_order()
        
        # Build each section
        for section_name in section_order:
            # Check if section exists in content
            section_content = self._get_section_content(content, section_name)
            if section_content is None:
                continue
            
            # Check visibility
            if VisibilityRules.should_show_section(section_name, content, force_minimal):
                # Add section directly
                section_blocks = self._build_visible_section(
                    section_name,
                    section_content,
                    content,
                    template
                )
                blocks.extend(section_blocks)
            else:
                # Add section in toggle
                toggle_block = self._build_toggle_section(
                    section_name,
                    section_content,
                    content,
                    template
                )
                if toggle_block:
                    blocks.append(toggle_block)
        
        # Add spacing between sections if not minimal
        if not force_minimal:
            blocks = self._add_section_spacing(blocks)
        
        return blocks
    
    def _get_section_content(
        self,
        content: EnrichedContent,
        section_name: str
    ) -> Optional[Any]:
        """Get content for a section by name."""
        # Handle special sections
        if section_name == "quality_indicator":
            return None  # Already handled
        
        # Try core sections first
        if section_name == "executive_summary":
            return content.executive_summary if content.executive_summary else None
        elif section_name == "key_insights":
            return content.key_insights if content.key_insights else None
        elif section_name == "action_items":
            return content.action_items if content.action_items else None
        elif section_name == "raw_content":
            return content.raw_content
        elif section_name == "attribution":
            return content.attribution
        elif section_name == "processing_metadata":
            return content.processing_metrics
        
        # Check raw sections
        return content.raw_sections.get(section_name)
    
    def _build_visible_section(
        self,
        section_name: str,
        section_content: Any,
        content: EnrichedContent,
        template: ContentTemplate
    ) -> List[Dict[str, Any]]:
        """Build blocks for a visible (non-toggle) section."""
        blocks = []
        
        # Add section header
        icon = template.get_section_icon(section_name)
        header_text = self._format_section_header(section_name)
        
        # Check if should use callout
        if VisibilityRules.should_use_callout(section_name, content):
            # Format as callout
            callout_blocks = self._build_callout_section(
                icon,
                header_text,
                section_content,
                content,
                template,
                section_name
            )
            blocks.extend(callout_blocks)
        else:
            # Regular header + content
            blocks.append(self._create_header_block(f"{icon} {header_text}", 2))
            
            # Format section content
            content_blocks = template.format_section(
                section_name,
                section_content,
                content
            )
            
            # Apply platform optimizations
            content_blocks = self._optimize_for_platform(content_blocks)
            blocks.extend(content_blocks)
        
        return blocks
    
    def _build_toggle_section(
        self,
        section_name: str,
        section_content: Any,
        content: EnrichedContent,
        template: ContentTemplate
    ) -> Optional[Dict[str, Any]]:
        """Build a toggle block for a section."""
        if section_content is None:
            return None
        
        icon = template.get_section_icon(section_name)
        header_text = self._format_section_header(section_name)
        
        # Add size warning for large content
        size_warning = ""
        if section_name == "raw_content" and content.raw_content_size_bytes > 1_000_000:
            size_mb = content.raw_content_size_bytes / 1_048_576
            size_warning = f" ({size_mb:.1f} MB)"
        
        # Format section content
        content_blocks = template.format_section(
            section_name,
            section_content,
            content
        )
        
        # Apply platform optimizations
        content_blocks = self._optimize_for_platform(content_blocks)
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"{icon} {header_text}{size_warning}"
                        }
                    }
                ],
                "children": content_blocks
            }
        }
    
    def _build_callout_section(
        self,
        icon: str,
        header_text: str,
        section_content: Any,
        content: EnrichedContent,
        template: ContentTemplate,
        section_name: str
    ) -> List[Dict[str, Any]]:
        """Build a callout block for a section."""
        # Determine callout color based on content
        color = self._get_callout_color(section_name, content)
        
        # Format content
        content_blocks = template.format_section(
            section_name,
            section_content,
            content
        )
        
        # For mobile, use compact callout
        if self.settings["callout_style"] == "compact":
            # Combine header and first content item
            return [{
                "type": "callout",
                "callout": {
                    "rich_text": self._combine_header_and_content(
                        header_text,
                        content_blocks
                    ),
                    "icon": {"emoji": icon},
                    "color": color
                }
            }]
        else:
            # Full callout with children
            return [{
                "type": "callout",
                "callout": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": header_text}
                        }
                    ],
                    "icon": {"emoji": icon},
                    "color": color,
                    "children": content_blocks
                }
            }]
    
    def _optimize_for_platform(
        self,
        blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Optimize blocks for target platform."""
        optimized = []
        
        for block in blocks:
            # Convert tables to cards on mobile
            if block.get("type") == "table" and not self.settings["use_tables"]:
                card_blocks = self._convert_table_to_cards(block)
                optimized.extend(card_blocks)
            
            # Wrap long lines
            elif block.get("type") in ["paragraph", "bulleted_list_item"]:
                optimized.append(self._wrap_text_block(block))
            
            else:
                optimized.append(block)
        
        return optimized
    
    def _add_section_spacing(
        self,
        blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Add appropriate spacing between sections."""
        spaced = []
        
        for i, block in enumerate(blocks):
            spaced.append(block)
            
            # Add spacing after major sections
            if i < len(blocks) - 1:
                next_block = blocks[i + 1]
                if self._should_add_spacing(block, next_block):
                    spaced.append({"type": "divider", "divider": {}})
        
        return spaced
    
    def _format_section_header(self, section_name: str) -> str:
        """Format section name as header text."""
        # Convert snake_case to Title Case
        words = section_name.replace("_", " ").split()
        return " ".join(word.capitalize() for word in words)
    
    def _get_callout_color(
        self,
        section_name: str,
        content: EnrichedContent
    ) -> str:
        """Get appropriate callout color for section."""
        if section_name == "action_items" and content.has_critical_actions():
            return "red_background"
        elif section_name == "risk_assessment":
            return "yellow_background"
        elif section_name == "market_impact":
            return "blue_background"
        else:
            return "gray_background"
    
    def _create_header_block(self, text: str, level: int = 2) -> Dict[str, Any]:
        """Create a header block."""
        header_type = f"heading_{level}" if level in [1, 2, 3] else "heading_3"
        
        return {
            "type": header_type,
            header_type: {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": text}
                    }
                ]
            }
        }
    
    def _combine_header_and_content(
        self,
        header: str,
        content_blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Combine header and first content item for compact display."""
        rich_text = [
            {
                "type": "text",
                "text": {"content": f"{header}: "},
                "annotations": {"bold": True}
            }
        ]
        
        # Extract first text content
        if content_blocks and content_blocks[0].get("type") == "paragraph":
            first_content = content_blocks[0].get("paragraph", {}).get("rich_text", [])
            if first_content:
                rich_text.extend(first_content)
        
        return rich_text
    
    def _convert_table_to_cards(self, table_block: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert table to card format for mobile."""
        # This would convert table rows to individual callout "cards"
        # Implementation depends on table structure
        # For now, return as-is
        return [table_block]
    
    def _wrap_text_block(self, block: Dict[str, Any]) -> Dict[str, Any]:
        """Wrap text in block for platform line length."""
        # This would implement text wrapping based on platform settings
        # For now, return as-is
        return block
    
    def _should_add_spacing(
        self,
        current_block: Dict[str, Any],
        next_block: Dict[str, Any]
    ) -> bool:
        """Determine if spacing should be added between blocks."""
        # Add spacing before major sections
        major_types = {"callout", "toggle", "heading_2"}
        
        return (
            current_block.get("type") in major_types and
            next_block.get("type") in major_types
        )