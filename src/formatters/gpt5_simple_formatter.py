"""
Simple GPT-5 formatter that works with any response format.
Creates rich Notion blocks from GPT-5 analysis without strict format requirements.
"""
import re
from typing import List, Dict, Any
from datetime import datetime
from utils.logging import setup_logger


class GPT5SimpleFormatter:
    """Simple formatter for GPT-5 responses that creates rich Notion blocks."""

    def __init__(self):
        self.logger = setup_logger(__name__)

    def format_gpt5_analysis(self,
                            content: str,
                            quality_score: float,
                            processing_time: float,
                            drive_url: str) -> List[Dict[str, Any]]:
        """
        Format GPT-5 analysis into Notion blocks.
        Works with any content format, not just structured markdown.
        """
        blocks = []

        # 1. Quality header with metrics
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"⭐ Quality: {quality_score:.1f}/10 | ⏱️ GPT-5 ({processing_time:.1f}s) | 🚀 Enhanced Analysis"
                    }
                }],
                "icon": {"type": "emoji", "emoji": "🏆"},
                "color": "blue_background"
            }
        })

        # 2. Parse content into sections
        # Try to find section headers (##, ###, etc.)
        sections = self._split_into_sections(content)

        if sections:
            # Content has structure, use it
            for section in sections[:10]:  # Limit to 10 sections
                blocks.append(self._create_section_block(section))
        else:
            # No structure found, split into paragraphs
            paragraphs = content.split('\n\n')
            for i, para in enumerate(paragraphs[:10]):  # Limit to 10 blocks
                if para.strip():
                    blocks.append(self._create_paragraph_block(para.strip(), i == 0))

        # 3. Add Drive link reference
        blocks.append({
            "type": "divider",
            "divider": {}
        })

        blocks.append({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"📎 Original Document: "},
                    "annotations": {"bold": True}
                }, {
                    "type": "text",
                    "text": {"content": drive_url, "link": {"url": drive_url}},
                    "annotations": {"color": "blue"}
                }]
            }
        })

        self.logger.info(f"Generated {len(blocks)} Notion blocks from GPT-5 analysis")
        return blocks

    def _split_into_sections(self, content: str) -> List[Dict[str, Any]]:
        """Split content into sections based on headers."""
        sections = []

        # Look for markdown headers (##, ###, etc.)
        pattern = r'^(#{1,4})\s+(.+?)$'
        lines = content.split('\n')

        current_section = None
        for line in lines:
            match = re.match(pattern, line)
            if match:
                # Save previous section
                if current_section:
                    sections.append(current_section)

                # Start new section
                header_level = len(match.group(1))
                header_text = match.group(2)
                current_section = {
                    'level': header_level,
                    'title': header_text,
                    'content': []
                }
            elif current_section:
                current_section['content'].append(line)
            elif line.strip():  # Content before first header
                if not sections:
                    sections.append({
                        'level': 0,
                        'title': None,
                        'content': [line]
                    })
                else:
                    sections[-1]['content'].append(line)

        # Add last section
        if current_section:
            sections.append(current_section)

        return sections

    def _create_section_block(self, section: Dict[str, Any]) -> Dict[str, Any]:
        """Create a Notion block for a section."""
        content = '\n'.join(section['content']).strip()

        # If section has a title, create a toggle block
        if section['title']:
            # Clean up title - remove block count annotations
            clean_title = re.sub(r'\s*\([^)]*blocks?[^)]*\)\s*$', '', section['title'])
            clean_title = re.sub(r'\s*\(max\)?\s*$', '', clean_title)

            # Extract emoji if present
            emoji_match = re.match(r'^([\U0001F000-\U0001F9FF])\s+(.+)', clean_title)
            if emoji_match:
                emoji = emoji_match.group(1)
                title = emoji_match.group(2)
            else:
                emoji = "📌"
                title = clean_title

            return {
                "type": "toggle",
                "toggle": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": f"{emoji} {title}"},
                        "annotations": {"bold": True}
                    }],
                    "children": [
                        self._create_paragraph_block(content, False)
                    ] if content else []
                }
            }
        else:
            # No title, just create a paragraph
            return self._create_paragraph_block(content, False)

    def _create_paragraph_block(self, text: str, is_first: bool) -> Dict[str, Any]:
        """Create a paragraph block with smart formatting."""
        # Check if it's a list
        if text.startswith(('- ', '* ', '• ', '1. ', '2. ', '3. ')):
            # Convert to bulleted list
            items = text.split('\n')
            rich_text_items = []

            for item in items[:5]:  # Limit list items
                if item.strip():
                    # Clean up list markers
                    clean_item = re.sub(r'^[-*•\d.]\s+', '', item.strip())

                    # Check for bold parts (text between ** or __)
                    parts = re.split(r'\*\*(.*?)\*\*', clean_item)
                    rich_text = []
                    for i, part in enumerate(parts):
                        if part:
                            rich_text.append({
                                "type": "text",
                                "text": {"content": part},
                                "annotations": {"bold": i % 2 == 1}  # Odd indices are bold
                            })

                    if rich_text:
                        rich_text_items.append(rich_text)

            # Return first item as a bulleted list (Notion limitation)
            if rich_text_items:
                return {
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": rich_text_items[0]
                    }
                }

        # Check if it's a key insight or important point
        if is_first or text.startswith(('IMPORTANT:', 'KEY:', 'NOTE:', 'CRITICAL:')):
            # Create a callout for important content
            return {
                "type": "callout",
                "callout": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": text[:1000]}  # Limit text length
                    }],
                    "icon": {"type": "emoji", "emoji": "💡"},
                    "color": "gray_background"
                }
            }

        # Regular paragraph
        return {
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": text[:2000]}  # Limit text length
                }]
            }
        }