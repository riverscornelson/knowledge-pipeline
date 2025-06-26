#!/usr/bin/env python3
"""
Markdown to Notion Blocks Converter

Converts markdown content to properly formatted Notion blocks for better UI rendering.
Handles headers, lists, bold/italic text, links, quotes, and code blocks.
"""

import re
from typing import List, Dict, Any, Optional, Tuple

class MarkdownToNotionConverter:
    """Convert markdown content to Notion block format"""
    
    def __init__(self):
        self.max_text_length = 2000  # Notion text limit per block
        
    def convert(self, markdown_text: str) -> List[Dict[str, Any]]:
        """Convert markdown text to list of Notion blocks"""
        
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
                i += 1
                while i < len(lines) and not lines[i].startswith('```'):
                    code_lines.append(lines[i])
                    i += 1
                    
                blocks.append(self._create_code_block('\n'.join(code_lines)))
                
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
            
        return blocks if blocks else [self._create_paragraph_block("")]

    def _create_heading_block(self, line: str) -> Dict[str, Any]:
        """Create a heading block from markdown header"""
        
        # Determine heading level
        level = 1
        content = line.lstrip('#').strip()
        
        if line.startswith('###'):
            level = 3
        elif line.startswith('##'):
            level = 2
        else:
            level = 1
            
        # Map to Notion heading types
        heading_type = f"heading_{level}"
        
        return {
            "object": "block",
            "type": heading_type,
            heading_type: {
                "rich_text": self._parse_rich_text(content)
            }
        }

    def _create_paragraph_block(self, text: str) -> Dict[str, Any]:
        """Create a paragraph block with rich text formatting"""
        
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": self._parse_rich_text(text)
            }
        }

    def _create_list_item(self, line: str, list_type: str) -> Dict[str, Any]:
        """Create a list item block"""
        
        # Remove list markers
        if list_type == 'bulleted':
            content = re.sub(r'^[\s]*[-*+]\s+', '', line)
        else:  # numbered
            content = re.sub(r'^[\s]*\d+\.\s+', '', line)
            
        block_type = f"{list_type}_list_item"
        
        return {
            "object": "block",
            "type": block_type,
            block_type: {
                "rich_text": self._parse_rich_text(content)
            }
        }

    def _finalize_list(self, list_items: List[Dict], list_type: str) -> List[Dict[str, Any]]:
        """Convert list items to final blocks"""
        return list_items

    def _create_quote_block(self, line: str) -> Dict[str, Any]:
        """Create a quote block"""
        
        content = line.lstrip('>').strip()
        
        return {
            "object": "block",
            "type": "quote",
            "quote": {
                "rich_text": self._parse_rich_text(content)
            }
        }

    def _create_code_block(self, code: str) -> Dict[str, Any]:
        """Create a code block"""
        
        return {
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": code}}],
                "language": "plain text"
            }
        }

    def _parse_rich_text(self, text: str) -> List[Dict[str, Any]]:
        """Parse text with markdown formatting into Notion rich text format"""
        
        if not text:
            return [{"type": "text", "text": {"content": ""}}]
            
        # Handle text length limits
        if len(text) > self.max_text_length:
            text = text[:self.max_text_length-3] + "..."
            
        rich_text_parts = []
        
        # Simple regex patterns for markdown formatting
        # This is a simplified parser - could be enhanced with more sophisticated parsing
        
        # Split by formatting patterns while preserving the patterns
        parts = self._split_with_patterns(text)
        
        for part in parts:
            if not part:
                continue
                
            # Check for different formatting types
            annotations = {}
            content = part
            
            # Bold text (**text** or __text__)
            if re.match(r'\*\*.*?\*\*', part) or re.match(r'__.*?__', part):
                annotations["bold"] = True
                content = re.sub(r'\*\*(.*?)\*\*', r'\1', content)
                content = re.sub(r'__(.*?)__', r'\1', content)
                
            # Italic text (*text* or _text_)
            elif re.match(r'\*.*?\*', part) or re.match(r'_.*?_', part):
                annotations["italic"] = True
                content = re.sub(r'\*(.*?)\*', r'\1', content)
                content = re.sub(r'_(.*?)_', r'\1', content)
                
            # Inline code (`text`)
            elif re.match(r'`.*?`', part):
                annotations["code"] = True
                content = re.sub(r'`(.*?)`', r'\1', content)
                
            # Links [text](url)
            link_match = re.match(r'\[([^\]]+)\]\(([^)]+)\)', part)
            if link_match:
                content = link_match.group(1)
                annotations["href"] = link_match.group(2)
                
            rich_text_parts.append({
                "type": "text",
                "text": {"content": content},
                "annotations": annotations if annotations else {}
            })
            
        return rich_text_parts if rich_text_parts else [{"type": "text", "text": {"content": text}}]

    def _split_with_patterns(self, text: str) -> List[str]:
        """Split text by markdown patterns while preserving them"""
        
        # Patterns for markdown formatting
        patterns = [
            r'\*\*[^*]+\*\*',  # Bold
            r'__[^_]+__',      # Bold alt
            r'\*[^*]+\*',      # Italic
            r'_[^_]+_',        # Italic alt
            r'`[^`]+`',        # Code
            r'\[[^\]]+\]\([^)]+\)',  # Links
        ]
        
        # Create a combined pattern
        combined_pattern = '|'.join(f'({pattern})' for pattern in patterns)
        
        if not re.search(combined_pattern, text):
            return [text]
            
        parts = re.split(f'({combined_pattern})', text)
        return [part for part in parts if part]

    def _create_callout_block(self, text: str, icon: str = "💡") -> Dict[str, Any]:
        """Create a callout block for important information"""
        
        return {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": self._parse_rich_text(text),
                "icon": {"type": "emoji", "emoji": icon}
            }
        }

    def _create_divider_block(self) -> Dict[str, Any]:
        """Create a divider block"""
        
        return {
            "object": "block",
            "type": "divider",
            "divider": {}
        }

# Main conversion function
def markdown_to_notion_blocks(markdown_text: str) -> List[Dict[str, Any]]:
    """
    Convert markdown text to Notion blocks
    
    Args:
        markdown_text: Markdown formatted text
        
    Returns:
        List of Notion block objects
    """
    converter = MarkdownToNotionConverter()
    return converter.convert(markdown_text)

# Enhanced conversion with smart content detection
def smart_markdown_to_notion_blocks(markdown_text: str, content_type: str = "general") -> List[Dict[str, Any]]:
    """
    Convert markdown with smart content detection for specific formats
    
    Args:
        markdown_text: Markdown formatted text
        content_type: Type of content (general, insights, summary, etc.)
        
    Returns:
        List of Notion block objects with enhanced formatting
    """
    converter = MarkdownToNotionConverter()
    blocks = converter.convert(markdown_text)
    
    # Add content-specific enhancements
    if content_type == "insights":
        # Add callouts for key insights
        enhanced_blocks = []
        for block in blocks:
            if block["type"] == "paragraph":
                text = block["paragraph"]["rich_text"][0]["text"]["content"]
                if any(keyword in text.lower() for keyword in ["key", "important", "critical", "opportunity", "risk"]):
                    enhanced_blocks.append(converter._create_callout_block(text))
                else:
                    enhanced_blocks.append(block)
            else:
                enhanced_blocks.append(block)
        return enhanced_blocks
        
    elif content_type == "summary":
        # Add dividers between summary sections
        enhanced_blocks = []
        for i, block in enumerate(blocks):
            enhanced_blocks.append(block)
            if i < len(blocks) - 1 and block["type"] == "heading_2":
                enhanced_blocks.append(converter._create_divider_block())
        return enhanced_blocks
        
    return blocks

# Utility function for testing
def test_conversion():
    """Test the markdown conversion with sample content"""
    
    sample_markdown = """
# Main Heading

This is a **bold** statement with *italic* text and `inline code`.

## Subheading

Here's a bullet list:
- First item
- Second item with **bold text**
- Third item

And a numbered list:
1. First numbered item
2. Second numbered item
3. Third numbered item

> This is a quote block

Here's a [link](https://example.com) in text.

```python
def hello_world():
    print("Hello, World!")
```

Another paragraph with regular text.
"""
    
    blocks = markdown_to_notion_blocks(sample_markdown)
    
    print("Converted blocks:")
    for i, block in enumerate(blocks):
        print(f"{i+1}. {block['type']}: {block}")
        
if __name__ == "__main__":
    test_conversion()