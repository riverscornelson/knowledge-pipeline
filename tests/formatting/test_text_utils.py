"""Tests for text utilities."""

import pytest

from src.formatting.text_utils import TextChunker


class TestTextChunker:
    """Test TextChunker functionality."""
    
    def test_short_text_not_chunked(self):
        """Test that short text is not chunked."""
        text = "This is a short text."
        chunks = TextChunker.chunk_text(text)
        
        assert len(chunks) == 1
        assert chunks[0] == text
    
    def test_long_text_chunked_on_sentences(self):
        """Test that long text is chunked on sentence boundaries."""
        # Create text with multiple sentences
        sentences = ["This is sentence one."] * 50
        text = " ".join(sentences)
        
        chunks = TextChunker.chunk_text(text, max_length=200)
        
        # Should be multiple chunks
        assert len(chunks) > 1
        
        # Each chunk should be under the limit
        for chunk in chunks:
            assert len(chunk) <= 200
        
        # Chunks should end with periods (sentence boundaries)
        for chunk in chunks[:-1]:  # All but last
            assert chunk.endswith('.')
    
    def test_very_long_sentence_chunked(self):
        """Test that very long sentences are split."""
        # Create a very long sentence without periods
        words = ["word"] * 500
        text = " ".join(words)
        
        chunks = TextChunker.chunk_text(text, max_length=100)
        
        # Should be multiple chunks
        assert len(chunks) > 1
        
        # Each chunk should be under the limit
        for chunk in chunks:
            assert len(chunk) <= 100
    
    def test_chunk_text_with_commas(self):
        """Test chunking on comma boundaries for long sentences."""
        # Create long sentence with commas
        parts = ["this is a long part"] * 50
        text = ", ".join(parts)
        
        chunks = TextChunker.chunk_text(text, max_length=100)
        
        # Should be multiple chunks
        assert len(chunks) > 1
        
        # Each chunk should be under the limit
        for chunk in chunks:
            assert len(chunk) <= 100
    
    def test_notion_api_limit(self):
        """Test with Notion API's actual limit."""
        # Create text just over the limit
        text = "a" * 2100
        
        chunks = TextChunker.chunk_text(text)
        
        # Should be split
        assert len(chunks) == 2
        
        # Each chunk should be under the safe limit
        for chunk in chunks:
            assert len(chunk) <= TextChunker.SAFE_TEXT_LENGTH
    
    def test_create_chunked_blocks(self):
        """Test creating Notion blocks from chunked text."""
        text = "This is a test. " * 200  # Long text
        
        blocks = TextChunker.create_chunked_blocks(
            text=text,
            block_type="paragraph",
            block_key="paragraph"
        )
        
        # Should create multiple blocks
        assert len(blocks) > 1
        
        # Each block should have correct structure
        for block in blocks:
            assert block["type"] == "paragraph"
            assert "paragraph" in block
            assert "rich_text" in block["paragraph"]
            assert len(block["paragraph"]["rich_text"]) == 1
            
            # Check text length
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            assert len(content) <= TextChunker.SAFE_TEXT_LENGTH
    
    def test_create_chunked_blocks_with_annotations(self):
        """Test creating blocks with text annotations."""
        text = "Important text " * 200
        
        blocks = TextChunker.create_chunked_blocks(
            text=text,
            block_type="paragraph",
            block_key="paragraph",
            annotations={"bold": True, "color": "red"}
        )
        
        # Check annotations are applied
        for block in blocks:
            rich_text = block["paragraph"]["rich_text"][0]
            assert "annotations" in rich_text
            assert rich_text["annotations"]["bold"] is True
            assert rich_text["annotations"]["color"] == "red"
    
    def test_create_chunked_blocks_with_prefix(self):
        """Test creating blocks with continuation prefix."""
        text = "Long text " * 200
        
        blocks = TextChunker.create_chunked_blocks(
            text=text,
            block_type="paragraph",
            block_key="paragraph",
            prefix="... "
        )
        
        # First block should not have prefix
        first_content = blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert not first_content.startswith("... ")
        
        # Subsequent blocks should have prefix
        if len(blocks) > 1:
            for block in blocks[1:]:
                content = block["paragraph"]["rich_text"][0]["text"]["content"]
                assert content.startswith("... ")
    
    def test_edge_cases(self):
        """Test edge cases."""
        # Empty text
        chunks = TextChunker.chunk_text("")
        assert chunks == [""]
        
        # Single word longer than limit
        long_word = "a" * 3000
        chunks = TextChunker.chunk_text(long_word, max_length=100)
        assert len(chunks) > 1
        
        # Text exactly at limit
        text = "a" * TextChunker.SAFE_TEXT_LENGTH
        chunks = TextChunker.chunk_text(text)
        assert len(chunks) == 1
        
        # Text one character over limit
        text = "a" * (TextChunker.SAFE_TEXT_LENGTH + 1)
        chunks = TextChunker.chunk_text(text)
        assert len(chunks) == 2