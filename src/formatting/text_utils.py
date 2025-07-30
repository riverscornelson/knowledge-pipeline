"""
Text utilities for formatting system.

Handles text chunking and other text processing needs for Notion API compliance.
"""

from typing import List, Dict, Any


class TextChunker:
    """Utilities for chunking text to comply with Notion API limits."""
    
    # Notion API limit for rich text content
    MAX_TEXT_LENGTH = 2000
    
    # Leave some buffer for safety
    SAFE_TEXT_LENGTH = 1900
    
    @classmethod
    def chunk_text(cls, text: str, max_length: int = None) -> List[str]:
        """
        Split text into chunks that don't exceed the maximum length.
        
        Args:
            text: The text to chunk
            max_length: Maximum length per chunk (defaults to SAFE_TEXT_LENGTH)
            
        Returns:
            List of text chunks
        """
        if max_length is None:
            max_length = cls.SAFE_TEXT_LENGTH
        
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        
        # Try to split on sentence boundaries first
        sentences = text.split('. ')
        current_chunk = ""
        
        for i, sentence in enumerate(sentences):
            # Add period back except for last sentence
            if i < len(sentences) - 1:
                sentence += '.'
            
            # If adding this sentence would exceed limit, start new chunk
            if current_chunk and len(current_chunk) + len(sentence) + 1 > max_length:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
            
            # If single sentence exceeds limit, split it
            if len(current_chunk) > max_length:
                # Split long sentence on commas, semicolons, or words
                sentence_chunks = cls._split_long_sentence(current_chunk, max_length)
                chunks.extend(sentence_chunks[:-1])
                current_chunk = sentence_chunks[-1]
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    @classmethod
    def _split_long_sentence(cls, text: str, max_length: int) -> List[str]:
        """Split a long sentence that exceeds max length."""
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        
        # Try splitting on commas first
        parts = text.split(', ')
        if len(parts) > 1:
            current = ""
            for i, part in enumerate(parts):
                if i < len(parts) - 1:
                    part += ','
                
                if current and len(current) + len(part) + 1 > max_length:
                    chunks.append(current.strip())
                    current = part
                else:
                    if current:
                        current += " " + part
                    else:
                        current = part
            
            if current:
                if len(current) > max_length:
                    # Still too long, split on words
                    chunks.extend(cls._split_on_words(current, max_length))
                else:
                    chunks.append(current.strip())
        else:
            # No commas, split on words
            chunks = cls._split_on_words(text, max_length)
        
        return chunks
    
    @classmethod
    def _split_on_words(cls, text: str, max_length: int) -> List[str]:
        """Split text on word boundaries."""
        words = text.split()
        chunks = []
        current = ""
        
        for word in words:
            # Handle single words that exceed max length
            if len(word) > max_length:
                # Save current chunk if any
                if current:
                    chunks.append(current.strip())
                    current = ""
                
                # Split the long word into chunks
                for i in range(0, len(word), max_length):
                    chunks.append(word[i:i + max_length])
            elif current and len(current) + len(word) + 1 > max_length:
                chunks.append(current.strip())
                current = word
            else:
                if current:
                    current += " " + word
                else:
                    current = word
        
        if current:
            chunks.append(current.strip())
        
        # If no words (text was all spaces), split by characters
        if not chunks and text:
            for i in range(0, len(text), max_length):
                chunks.append(text[i:i + max_length])
        
        return chunks
    
    @classmethod
    def create_chunked_blocks(
        cls,
        text: str,
        block_type: str,
        block_key: str,
        annotations: Dict[str, Any] = None,
        prefix: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Create multiple blocks if text exceeds limit.
        
        Args:
            text: The text to format
            block_type: The Notion block type (e.g., "paragraph", "bulleted_list_item")
            block_key: The key for the block content (e.g., "paragraph", "bulleted_list_item")
            annotations: Optional text annotations
            prefix: Optional prefix for continuation blocks
            
        Returns:
            List of properly formatted blocks
        """
        chunks = cls.chunk_text(text)
        blocks = []
        
        for i, chunk in enumerate(chunks):
            # Add continuation prefix for subsequent chunks
            if i > 0 and prefix:
                chunk = prefix + chunk
            
            rich_text_item = {
                "type": "text",
                "text": {"content": chunk}
            }
            
            if annotations:
                rich_text_item["annotations"] = annotations
            
            blocks.append({
                "type": block_type,
                block_key: {
                    "rich_text": [rich_text_item]
                }
            })
        
        return blocks