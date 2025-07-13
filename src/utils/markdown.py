"""
Markdown to Notion blocks converter.
"""
import re
from typing import List, Dict, Any, Optional, Tuple


class MarkdownToNotionConverter:
    """Convert markdown content to Notion block format."""
    
    def __init__(self):
        """Initialize converter with Notion limits."""
        self.max_text_length = 2000  # Notion text limit per block
        
    def convert(self, markdown_text: str) -> List[Dict[str, Any]]:
        """
        Convert markdown text to list of Notion blocks.
        
        Args:
            markdown_text: Markdown formatted text
            
        Returns:
            List of Notion block objects
        """
        if not markdown_text or not markdown_text.strip():
            return [self._create_paragraph_block("")]
            
        # Split into lines and process
        lines = markdown_text.split('\n')
        blocks = []
        current_list_items = []
        current_list_type = None
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Skip empty lines (but preserve them for paragraph breaks)
            if not line.strip():
                # End any current list
                if current_list_items:
                    blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = []
                    current_list_type = None
                i += 1
                continue
                
            # Check for headers
            if line.startswith('#'):
                # End any current list
                if current_list_items:
                    blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = []
                    current_list_type = None
                    
                blocks.append(self._create_heading_block(line))
                
            # Check for bullet lists
            elif re.match(r'^[\s]*[-*+]\s+', line):
                list_item = self._create_list_item(line, 'bulleted')
                if current_list_type != 'bulleted':
                    # Finalize previous list if different type
                    if current_list_items:
                        blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = [list_item]
                    current_list_type = 'bulleted'
                else:
                    current_list_items.append(list_item)
                    
            # Check for numbered lists
            elif re.match(r'^[\s]*\d+\.\s+', line):
                list_item = self._create_list_item(line, 'numbered')
                if current_list_type != 'numbered':
                    # Finalize previous list if different type
                    if current_list_items:
                        blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = [list_item]
                    current_list_type = 'numbered'
                else:
                    current_list_items.append(list_item)
                    
            # Check for quotes
            elif line.startswith('>'):
                # End any current list
                if current_list_items:
                    blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = []
                    current_list_type = None
                    
                blocks.append(self._create_quote_block(line))
                
            # Check for code blocks
            elif line.startswith('```'):
                # End any current list
                if current_list_items:
                    blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = []
                    current_list_type = None
                    
                # Find end of code block
                code_lines = []
                language = line[3:].strip()
                i += 1
                while i < len(lines) and not lines[i].startswith('```'):
                    code_lines.append(lines[i])
                    i += 1
                    
                blocks.append(self._create_code_block('\n'.join(code_lines), language))
                
            # Regular paragraph
            else:
                # End any current list
                if current_list_items:
                    blocks.extend(self._finalize_list(current_list_items, current_list_type))
                    current_list_items = []
                    current_list_type = None
                    
                blocks.append(self._create_paragraph_block(line))
                
            i += 1
            
        # Finalize any remaining list
        if current_list_items:
            blocks.extend(self._finalize_list(current_list_items, current_list_type))
            
        return blocks
    
    def _create_heading_block(self, line: str) -> Dict[str, Any]:
        """Create a heading block from markdown header."""
        level = len(line) - len(line.lstrip('#'))
        text = line.lstrip('#').strip()
        
        # Notion only supports heading_1, heading_2, heading_3
        heading_type = f"heading_{min(level, 3)}"
        
        return {
            "object": "block",
            "type": heading_type,
            heading_type: {
                "rich_text": self._parse_rich_text(text)
            }
        }
    
    def _create_paragraph_block(self, text: str) -> Dict[str, Any]:
        """Create a paragraph block."""
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": self._parse_rich_text(text)
            }
        }
    
    def _create_list_item(self, line: str, list_type: str) -> str:
        """Extract list item text."""
        # Remove list markers
        if list_type == 'bulleted':
            text = re.sub(r'^[\s]*[-*+]\s+', '', line)
        else:
            text = re.sub(r'^[\s]*\d+\.\s+', '', line)
        return text
    
    def _finalize_list(self, items: List[str], list_type: str) -> List[Dict[str, Any]]:
        """Create list blocks from items."""
        blocks = []
        for item in items:
            block_type = f"{list_type}_list_item"
            blocks.append({
                "object": "block",
                "type": block_type,
                block_type: {
                    "rich_text": self._parse_rich_text(item)
                }
            })
        return blocks
    
    def _create_quote_block(self, line: str) -> Dict[str, Any]:
        """Create a quote block."""
        text = line.lstrip('>').strip()
        return {
            "object": "block",
            "type": "quote",
            "quote": {
                "rich_text": self._parse_rich_text(text)
            }
        }
    
    def _create_code_block(self, code: str, language: str = "") -> Dict[str, Any]:
        """Create a code block."""
        # Truncate if too long
        if len(code) > self.max_text_length:
            code = code[:self.max_text_length - 20] + "\n... (truncated)"
            
        return {
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": code}}],
                "language": language or "plain text"
            }
        }
    
    def _parse_rich_text(self, text: str) -> List[Dict[str, Any]]:
        """Parse text with markdown formatting into Notion rich text."""
        if not text:
            return []
            
        # Truncate if too long
        if len(text) > self.max_text_length:
            text = text[:self.max_text_length - 20] + "... (truncated)"
            
        rich_text = []
        
        # Simple parsing for bold, italic, and links
        # This is a basic implementation - could be enhanced
        parts = self._split_by_formatting(text)
        
        for part in parts:
            if part.startswith('**') and part.endswith('**'):
                # Bold
                content = part[2:-2]
                rich_text.append({
                    "type": "text",
                    "text": {"content": content},
                    "annotations": {"bold": True}
                })
            elif part.startswith('*') and part.endswith('*'):
                # Italic
                content = part[1:-1]
                rich_text.append({
                    "type": "text",
                    "text": {"content": content},
                    "annotations": {"italic": True}
                })
            elif part.startswith('[') and '](' in part and part.endswith(')'):
                # Link
                match = re.match(r'\[([^\]]+)\]\(([^\)]+)\)', part)
                if match:
                    link_text, url = match.groups()
                    rich_text.append({
                        "type": "text",
                        "text": {"content": link_text, "link": {"url": url}}
                    })
                else:
                    rich_text.append({"type": "text", "text": {"content": part}})
            else:
                # Plain text
                if part:
                    rich_text.append({"type": "text", "text": {"content": part}})
        
        return rich_text if rich_text else [{"type": "text", "text": {"content": text}}]
    
    def _split_by_formatting(self, text: str) -> List[str]:
        """Split text by formatting markers (simplified)."""
        # This is a very basic implementation
        # In production, you'd want a proper markdown parser
        parts = []
        
        # For now, just return the whole text as one part
        # A full implementation would parse bold, italic, links, etc.
        parts.append(text)
        
        return parts