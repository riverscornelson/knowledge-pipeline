"""
Unit tests for hierarchical text chunking functionality.
"""
import pytest
from unittest.mock import MagicMock
from src.enrichment.pipeline_processor import PipelineProcessor


class TestTextChunking:
    """Test the hierarchical chunking methods to ensure formatting preservation."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Mock the dependencies to avoid import issues in tests
        self.processor = PipelineProcessor.__new__(PipelineProcessor)
        # Manually copy the methods we need to test
        self.processor._chunk_text_to_blocks = PipelineProcessor._chunk_text_to_blocks.__get__(self.processor)
        self.processor._recursive_split = PipelineProcessor._recursive_split.__get__(self.processor)
        self.processor._create_paragraph_block = PipelineProcessor._create_paragraph_block.__get__(self.processor)
    
    def test_paragraph_preservation(self):
        """Test that paragraph breaks are preserved."""
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        blocks = self.processor._chunk_text_to_blocks(text, max_length=50)
        
        # Should create separate blocks respecting paragraph boundaries
        assert len(blocks) >= 2, "Should split at paragraph boundaries"
        
        # Check that paragraph separators are respected
        all_content = ""
        for block in blocks:
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            all_content += content + " "
        
        # Should contain complete paragraphs, not cut mid-paragraph
        assert "First paragraph." in all_content
        assert "Second paragraph." in all_content
        assert "Third paragraph." in all_content
    
    def test_line_break_preservation(self):
        """Test that line breaks are preserved when paragraphs fit."""
        text = "Line 1\nLine 2\nLine 3"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=100)
        
        # Should be in single block since it fits
        assert len(blocks) == 1
        content = blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert "Line 1\nLine 2\nLine 3" == content
    
    def test_list_formatting_preservation(self):
        """Test that list items are kept together when possible."""
        text = "• Item 1\n• Item 2\n• Item 3"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=100)
        
        # Should be in single block since it fits
        assert len(blocks) == 1
        content = blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert "• Item 1" in content
        assert "• Item 2" in content
        assert "• Item 3" in content
    
    def test_sentence_boundary_respect(self):
        """Test that sentences are split at proper boundaries."""
        text = "This is sentence one. This is sentence two. This is sentence three."
        blocks = self.processor._chunk_text_to_blocks(text, max_length=30)
        
        # Should split at sentence boundaries
        for block in blocks:
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            # Each block should contain complete sentences
            if ". " in content:
                assert not content.strip().endswith("This is"), "Should not cut sentences mid-way"
    
    def test_word_boundary_fallback(self):
        """Test that word boundaries are respected when other separators fail."""
        text = "verylongwordthatcannotbespliteasily another word here"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=30)
        
        # Should split at word boundaries
        for block in blocks:
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            words = content.split()
            # Each word should be complete (no truncation artifacts)
            for word in words:
                assert len(word) > 0, "No empty words"
                assert not any(word.endswith(frag) for frag in ['wha', 'ca', 'le', 'mo']), f"Word appears truncated: {word}"
    
    def test_hierarchical_separator_order(self):
        """Test that separators are applied in correct order."""
        text = "Para 1\n\nPara 2\nLine in para 2. Sentence in para 2."
        blocks = self.processor._chunk_text_to_blocks(text, max_length=20)
        
        # Should first split on \n\n (paragraph), then other separators
        found_para1 = False
        found_para2_start = False
        
        for block in blocks:
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            if "Para 1" in content:
                found_para1 = True
            if "Para 2" in content:
                found_para2_start = True
        
        assert found_para1, "Should preserve first paragraph"
        assert found_para2_start, "Should preserve second paragraph start"
    
    def test_no_truncation_artifacts(self):
        """Test that common truncation patterns are eliminated."""
        # Text with patterns that were previously truncated
        text = "brought what As you can at least minor model the feelings conspiracy beliefs emoji-studded get a sense released entered But past arguments"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=50)
        
        # Check that no blocks contain the old truncation patterns
        truncation_patterns = ['wha', 'ca', 'le', 'mo', 'feelin', 'beli', 'studde', 'sen', 'relea', 'entere']
        
        for block in blocks:
            content = block["paragraph"]["rich_text"][0]["text"]["content"]
            words = content.split()
            for word in words:
                assert word not in truncation_patterns, f"Found truncation artifact '{word}' in: '{content}'"
    
    def test_empty_text_handling(self):
        """Test handling of empty and whitespace-only text."""
        # Empty string
        blocks = self.processor._chunk_text_to_blocks("", max_length=100)
        assert len(blocks) == 0, "Empty text should produce no blocks"
        
        # Whitespace only
        blocks = self.processor._chunk_text_to_blocks("   \n\n   ", max_length=100)
        assert len(blocks) == 0, "Whitespace-only text should produce no blocks"
    
    def test_oversized_content_handling(self):
        """Test handling of content larger than max_length."""
        oversized_word = "a" * 2000
        text = f"start {oversized_word} end"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=100)
        
        # Should have multiple blocks
        assert len(blocks) >= 2
        
        # Check that we don't lose content entirely
        all_content = "".join(block["paragraph"]["rich_text"][0]["text"]["content"] for block in blocks)
        assert "start" in all_content
        assert "end" in all_content
        assert "a" in all_content  # Some part of the oversized word
    
    def test_notion_block_structure(self):
        """Test that generated blocks have correct Notion API structure."""
        text = "test content with\nmultiple lines"
        blocks = self.processor._chunk_text_to_blocks(text, max_length=100)
        
        for block in blocks:
            # Verify required Notion block structure
            assert "object" in block
            assert block["object"] == "block"
            assert "type" in block
            assert block["type"] == "paragraph"
            assert "paragraph" in block
            assert "rich_text" in block["paragraph"]
            assert isinstance(block["paragraph"]["rich_text"], list)
            assert len(block["paragraph"]["rich_text"]) > 0
            assert "type" in block["paragraph"]["rich_text"][0]
            assert "text" in block["paragraph"]["rich_text"][0]
            assert "content" in block["paragraph"]["rich_text"][0]["text"]
    
    def test_create_paragraph_block_helper(self):
        """Test the paragraph block creation helper method."""
        content = "test content"
        block = self.processor._create_paragraph_block(content)
        
        expected = {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": "test content"}}]
            }
        }
        
        assert block == expected
    
    def test_whitespace_normalization(self):
        """Test that content is properly stripped in blocks."""
        text = "  content with spaces  "
        blocks = self.processor._chunk_text_to_blocks(text, max_length=100)
        
        content = blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert content == "content with spaces", "Content should be stripped"
    
    def test_complex_formatting_scenario(self):
        """Test a complex real-world formatting scenario."""
        text = """# Header

This is a paragraph with multiple sentences. It has important information.

• Bullet point 1
• Bullet point 2
• Bullet point 3

Another paragraph here.

## Subheader

Final paragraph with conclusion."""
        
        blocks = self.processor._chunk_text_to_blocks(text, max_length=200)
        
        # Should create multiple blocks but preserve structure
        assert len(blocks) >= 1
        
        # Combine all content to verify completeness
        all_content = " ".join(block["paragraph"]["rich_text"][0]["text"]["content"] for block in blocks)
        
        assert "# Header" in all_content
        assert "Bullet point 1" in all_content
        assert "## Subheader" in all_content
        assert "Final paragraph" in all_content