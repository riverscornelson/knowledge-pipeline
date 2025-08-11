"""
Enhanced Notion formatter that transforms AI-generated content into rich, scannable Notion blocks.
Implements the formatting improvements to solve the "wall of text" problem.
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from utils.logging import setup_logger


class NotionFormatter:
    """Transforms AI-generated text into rich Notion blocks with visual hierarchy."""
    
    def __init__(self):
        """Initialize the formatter with configuration."""
        self.logger = setup_logger(__name__)
        
        # Emoji mapping for different content types
        self.section_emojis = {
            # Main sections
            "executive_summary": "📋",
            "summary": "📋",
            "overview": "🔍",
            "key_points": "🎯",
            "key_findings": "🎯",
            "insights": "💡",
            "strategic_implications": "🔮",
            "opportunities": "🚀",
            "strategic_opportunities": "🚀",
            "risks": "⚠️",
            "risk_factors": "⚠️",
            "challenges": "⚠️",
            "recommendations": "🎯",
            "actions": "⚡",
            "immediate_actions": "⚡",
            "next_steps": "⚡",
            "market_implications": "📰",
            "innovation_potential": "🚀",
            "methodology": "🔬",
            "technical": "🔧",
            "analysis": "📊",
            "metrics": "📈",
            "data": "📊",
            "classification": "🏷️",
            "vendor": "🏢",
            "market": "📰",
            "financial": "💵",
            "timeline": "⏰",
            "implementation": "🛠️",
            "security": "🔒",
            "performance": "⚡",
            "conclusion": "📝",
            # Status indicators
            "completed": "✅",
            "in_progress": "🔄",
            "pending": "⭕",
            "blocked": "❌",
            "warning": "⚠️",
            "success": "✅",
            "error": "❌",
            "info": "ℹ️"
        }
        
        # Maximum lengths for readability
        self.max_paragraph_sentences = 3
        self.max_bullet_words = 15
        self.max_line_chars = 80  # For mobile readability
        
    def format_content(self, text: str, content_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Transform AI-generated text into rich Notion blocks.
        
        Args:
            text: The AI-generated text to format
            content_type: Optional content type for specialized formatting
            
        Returns:
            List of Notion block objects
        """
        blocks = []
        
        # Split content into sections
        sections = self._split_into_sections(text)
        
        for section in sections:
            section_blocks = self._format_section(section, content_type)
            blocks.extend(section_blocks)
            
            # Add divider between major sections
            if section_blocks and section != sections[-1]:
                blocks.append(self._create_divider_block())
        
        return blocks
    
    def _split_into_sections(self, text: str) -> List[Dict[str, Any]]:
        """Split text into logical sections based on headers."""
        sections = []
        current_section = {"title": None, "content": [], "level": 0}
        
        lines = text.split('\n')
        
        for line in lines:
            # Check for headers
            if line.startswith('#'):
                # Save previous section if it has content
                if current_section["content"]:
                    sections.append(current_section)
                
                # Parse header level and title
                header_match = re.match(r'^(#+)\s*(.+)$', line)
                if header_match:
                    level = len(header_match.group(1))
                    title = header_match.group(2).strip()
                    current_section = {"title": title, "content": [], "level": level}
            else:
                # Add non-header lines to current section
                if line.strip():
                    current_section["content"].append(line.strip())
        
        # Add final section
        if current_section["content"] or current_section["title"]:
            sections.append(current_section)
        
        return sections
    
    def _format_section(self, section: Dict[str, Any], content_type: Optional[str]) -> List[Dict[str, Any]]:
        """Format a single section into Notion blocks."""
        blocks = []
        
        # Add header if present
        if section["title"]:
            emoji = self._get_emoji_for_title(section["title"])
            formatted_title = f"{emoji} {section['title']}" if emoji else section["title"]
            
            blocks.append(self._create_heading_block(
                formatted_title, 
                level=min(section["level"], 3)  # Notion supports h1-h3
            ))
        
        # Process content based on patterns
        content_text = '\n'.join(section["content"])
        
        # Check for specific patterns
        if self._is_table_content(content_text):
            blocks.extend(self._format_as_table(content_text))
        elif self._is_list_content(content_text):
            blocks.extend(self._format_as_list(content_text))
        elif self._is_key_value_content(content_text):
            blocks.extend(self._format_as_callout(content_text))
        else:
            # Format as paragraphs with proper breaks
            blocks.extend(self._format_as_paragraphs(content_text))
        
        return blocks
    
    def _get_emoji_for_title(self, title: str) -> Optional[str]:
        """Get appropriate emoji for section title."""
        title_lower = title.lower()
        
        # Check for exact matches first
        for key, emoji in self.section_emojis.items():
            if key in title_lower:
                return emoji
        
        # Check for keyword patterns
        if any(word in title_lower for word in ["key", "main", "important", "critical"]):
            return "🎯"
        elif any(word in title_lower for word in ["risk", "challenge", "issue", "problem"]):
            return "⚠️"
        elif any(word in title_lower for word in ["opportunity", "benefit", "advantage"]):
            return "🚀"
        elif any(word in title_lower for word in ["data", "metric", "number", "statistic"]):
            return "📊"
        
        return None
    
    def _is_table_content(self, text: str) -> bool:
        """Detect if content should be formatted as a table."""
        lines = text.strip().split('\n')
        
        # Check for pipe-delimited content
        if any('|' in line for line in lines):
            return True
        
        # Check for consistent colon patterns (key: value)
        colon_lines = [line for line in lines if ':' in line]
        if len(colon_lines) >= 3:
            return True
        
        # Check for tabular keywords
        table_keywords = ["comparison", "versus", "vs", "matrix", "attributes"]
        return any(keyword in text.lower() for keyword in table_keywords)
    
    def _is_list_content(self, text: str) -> bool:
        """Detect if content should be formatted as a list."""
        lines = text.strip().split('\n')
        
        # Check for bullet points or numbers
        list_patterns = [r'^\s*[-•*]\s+', r'^\s*\d+[.)]\s+']
        list_lines = 0
        
        for line in lines:
            if any(re.match(pattern, line) for pattern in list_patterns):
                list_lines += 1
        
        return list_lines >= 2
    
    def _is_key_value_content(self, text: str) -> bool:
        """Detect if content is key-value pairs suitable for callout."""
        lines = text.strip().split('\n')
        
        # Check for consistent key: value pattern
        kv_pattern = r'^[^:]+:\s*.+$'
        kv_lines = [line for line in lines if re.match(kv_pattern, line)]
        
        return 2 <= len(kv_lines) <= 5  # Good for callout blocks
    
    def _format_as_table(self, text: str) -> List[Dict[str, Any]]:
        """Format content as a Notion table."""
        blocks = []
        lines = text.strip().split('\n')
        
        # Parse table data
        table_data = []
        headers = []
        
        for i, line in enumerate(lines):
            if '|' in line:
                # Parse pipe-delimited table
                cells = [cell.strip() for cell in line.split('|') if cell.strip()]
                if i == 0:
                    headers = cells
                else:
                    table_data.append(cells)
            elif ':' in line and not headers:
                # Parse key-value pairs
                key, value = line.split(':', 1)
                if not headers:
                    headers = ["Attribute", "Value"]
                table_data.append([key.strip(), value.strip()])
        
        # Create table block
        if headers and table_data:
            blocks.append(self._create_table_block(headers, table_data))
        
        return blocks
    
    def _format_as_list(self, text: str) -> List[Dict[str, Any]]:
        """Format content as properly structured lists."""
        blocks = []
        lines = text.strip().split('\n')
        
        current_list_type = None
        current_list_items = []
        
        for line in lines:
            # Check for bullet points
            bullet_match = re.match(r'^\s*[-•*]\s+(.+)$', line)
            number_match = re.match(r'^\s*\d+[.)]\s+(.+)$', line)
            
            if bullet_match:
                if current_list_type == "numbered" and current_list_items:
                    blocks.extend(self._create_list_block(current_list_items, numbered=True))
                    current_list_items = []
                
                current_list_type = "bulleted"
                content = bullet_match.group(1)
                current_list_items.append(self._break_long_list_item(content))
                
            elif number_match:
                if current_list_type == "bulleted" and current_list_items:
                    blocks.extend(self._create_list_block(current_list_items, numbered=False))
                    current_list_items = []
                
                current_list_type = "numbered"
                content = number_match.group(1)
                current_list_items.append(self._break_long_list_item(content))
                
            else:
                # Non-list content - flush current list
                if current_list_items:
                    blocks.extend(self._create_list_block(
                        current_list_items, 
                        numbered=(current_list_type == "numbered")
                    ))
                    current_list_items = []
                    current_list_type = None
                
                # Add as paragraph if not empty
                if line.strip():
                    blocks.append(self._create_paragraph_block(line.strip()))
        
        # Flush remaining list
        if current_list_items:
            blocks.extend(self._create_list_block(
                current_list_items, 
                numbered=(current_list_type == "numbered")
            ))
        
        return blocks
    
    def _format_as_callout(self, text: str) -> List[Dict[str, Any]]:
        """Format key-value content as a callout block."""
        # Determine callout style based on content
        icon = "💡"
        color = "blue_background"
        
        if any(word in text.lower() for word in ["warning", "risk", "caution"]):
            icon = "⚠️"
            color = "red_background"
        elif any(word in text.lower() for word in ["success", "complete", "done"]):
            icon = "✅"
            color = "green_background"
        
        return [self._create_callout_block(text, icon, color)]
    
    def _format_as_paragraphs(self, text: str) -> List[Dict[str, Any]]:
        """Format text as readable paragraphs with proper breaks."""
        blocks = []
        
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Group sentences into paragraphs
        current_paragraph = []
        
        for sentence in sentences:
            current_paragraph.append(sentence)
            
            # Check if we should start a new paragraph
            if len(current_paragraph) >= self.max_paragraph_sentences:
                paragraph_text = ' '.join(current_paragraph)
                blocks.append(self._create_paragraph_block(paragraph_text))
                current_paragraph = []
        
        # Add remaining sentences
        if current_paragraph:
            paragraph_text = ' '.join(current_paragraph)
            blocks.append(self._create_paragraph_block(paragraph_text))
        
        return blocks
    
    def _break_long_list_item(self, text: str) -> Dict[str, Any]:
        """Break long list items into main point + sub-bullets."""
        words = text.split()
        
        if len(words) <= self.max_bullet_words:
            return {"text": text, "children": []}
        
        # Find natural break point
        main_text = ' '.join(words[:self.max_bullet_words])
        remaining = ' '.join(words[self.max_bullet_words:])
        
        # Look for a better break at punctuation
        for i, word in enumerate(words[:self.max_bullet_words]):
            if word.endswith((',', ';', ':')) and i > 5:
                main_text = ' '.join(words[:i+1])
                remaining = ' '.join(words[i+1:])
                break
        
        return {
            "text": main_text,
            "children": [{"text": f"→ {remaining}", "children": []}] if remaining else []
        }
    
    # Notion block creation methods
    
    def _create_heading_block(self, text: str, level: int = 2) -> Dict[str, Any]:
        """Create a heading block."""
        heading_types = {1: "heading_1", 2: "heading_2", 3: "heading_3"}
        block_type = heading_types.get(level, "heading_2")
        
        return {
            "type": block_type,
            block_type: {
                "rich_text": [{"type": "text", "text": {"content": text}}]
            }
        }
    
    def _create_paragraph_block(self, text: str) -> Dict[str, Any]:
        """Create a paragraph block with rich text formatting."""
        # Apply inline formatting
        rich_text = self._parse_inline_formatting(text)
        
        return {
            "type": "paragraph",
            "paragraph": {"rich_text": rich_text}
        }
    
    def _create_list_block(self, items: List[Dict[str, Any]], numbered: bool = False) -> Dict[str, Any]:
        """Create bulleted or numbered list blocks."""
        blocks = []
        list_type = "numbered_list_item" if numbered else "bulleted_list_item"
        
        for item in items:
            block = {
                "type": list_type,
                list_type: {
                    "rich_text": self._parse_inline_formatting(item["text"])
                }
            }
            
            # Add children if present
            if item.get("children"):
                child_blocks = []
                for child in item["children"]:
                    child_block = {
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": self._parse_inline_formatting(child["text"])
                        }
                    }
                    child_blocks.append(child_block)
                
                # Children go inside the list item property
                block[list_type]["children"] = child_blocks
            
            blocks.append(block)
        
        return blocks
    
    def _create_callout_block(self, text: str, icon: str = "💡", color: str = "blue_background") -> Dict[str, Any]:
        """Create a callout block."""
        return {
            "type": "callout",
            "callout": {
                "rich_text": self._parse_inline_formatting(text),
                "icon": {"type": "emoji", "emoji": icon},
                "color": color
            }
        }
    
    def _create_table_block(self, headers: List[str], rows: List[List[str]]) -> Dict[str, Any]:
        """Create a table block."""
        # Ensure all rows have same number of columns
        col_count = len(headers)
        normalized_rows = []
        
        for row in rows:
            normalized_row = row[:col_count]  # Trim excess
            while len(normalized_row) < col_count:  # Pad missing
                normalized_row.append("")
            normalized_rows.append(normalized_row)
        
        # Create table rows
        table_rows = []
        
        # Header row
        header_cells = []
        for header in headers:
            header_cells.append([{"type": "text", "text": {"content": header}, "annotations": {"bold": True}}])
        table_rows.append({
            "type": "table_row",
            "table_row": {"cells": header_cells}
        })
        
        # Data rows
        for row in normalized_rows:
            cells = []
            for cell in row:
                cells.append([{"type": "text", "text": {"content": str(cell)}}])
            table_rows.append({
                "type": "table_row", 
                "table_row": {"cells": cells}
            })
        
        return {
            "type": "table",
            "table": {
                "table_width": col_count,
                "has_column_header": True,
                "children": table_rows
            }
        }
    
    def _create_divider_block(self) -> Dict[str, Any]:
        """Create a divider block."""
        return {"type": "divider", "divider": {}}
    
    def _create_toggle_block(self, title: str, children: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a toggle block with children."""
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": title}}],
                "children": children
            }
        }
    
    def _parse_inline_formatting(self, text: str) -> List[Dict[str, Any]]:
        """Parse inline markdown formatting to Notion rich text."""
        # Notion has a 2000 character limit per text content
        MAX_TEXT_LENGTH = 2000
        
        # If text is too long and has no formatting, chunk it
        if len(text) > MAX_TEXT_LENGTH and not re.search(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))', text):
            rich_text = []
            for i in range(0, len(text), MAX_TEXT_LENGTH):
                chunk = text[i:i + MAX_TEXT_LENGTH]
                rich_text.append({
                    "type": "text",
                    "text": {"content": chunk}
                })
            return rich_text
        
        rich_text = []
        
        # Pattern for inline formatting
        pattern = r'(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))'
        
        last_end = 0
        
        for match in re.finditer(pattern, text):
            # Add text before the match
            if match.start() > last_end:
                plain_text = text[last_end:match.start()]
                # Chunk plain text if needed
                for i in range(0, len(plain_text), MAX_TEXT_LENGTH):
                    chunk = plain_text[i:i + MAX_TEXT_LENGTH]
                    rich_text.append({
                        "type": "text",
                        "text": {"content": chunk}
                    })
            
            # Process the match
            if match.group(2):  # Bold
                content = match.group(2)
                # Chunk if needed
                for i in range(0, len(content), MAX_TEXT_LENGTH):
                    chunk = content[i:i + MAX_TEXT_LENGTH]
                    rich_text.append({
                        "type": "text",
                        "text": {"content": chunk},
                        "annotations": {"bold": True}
                    })
            elif match.group(3):  # Italic
                content = match.group(3)
                for i in range(0, len(content), MAX_TEXT_LENGTH):
                    chunk = content[i:i + MAX_TEXT_LENGTH]
                    rich_text.append({
                        "type": "text",
                        "text": {"content": chunk},
                        "annotations": {"italic": True}
                    })
            elif match.group(4):  # Code
                content = match.group(4)
                for i in range(0, len(content), MAX_TEXT_LENGTH):
                    chunk = content[i:i + MAX_TEXT_LENGTH]
                    rich_text.append({
                        "type": "text",
                        "text": {"content": chunk},
                        "annotations": {"code": True}
                    })
            elif match.group(5) and match.group(6):  # Link
                content = match.group(5)
                url = match.group(6)
                for i in range(0, len(content), MAX_TEXT_LENGTH):
                    chunk = content[i:i + MAX_TEXT_LENGTH]
                    rich_text.append({
                        "type": "text",
                        "text": {"content": chunk, "link": {"url": url}}
                })
            
            last_end = match.end()
        
        # Add remaining text
        if last_end < len(text):
            remaining_text = text[last_end:]
            # Chunk remaining text if needed
            for i in range(0, len(remaining_text), MAX_TEXT_LENGTH):
                chunk = remaining_text[i:i + MAX_TEXT_LENGTH]
                rich_text.append({
                    "type": "text",
                    "text": {"content": chunk}
                })
        
        # Handle empty rich_text - chunk if needed
        if not rich_text:
            for i in range(0, len(text), MAX_TEXT_LENGTH):
                chunk = text[i:i + MAX_TEXT_LENGTH]
                rich_text.append({
                    "type": "text",
                    "text": {"content": chunk}
                })
        
        return rich_text