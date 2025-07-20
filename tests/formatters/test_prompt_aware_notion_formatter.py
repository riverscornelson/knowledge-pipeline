"""
Unit tests for the prompt-aware Notion formatter.
Tests all key functionality including attribution, mobile optimization, and quality indicators.
"""
import pytest
from datetime import datetime
from unittest.mock import Mock, MagicMock
from src.formatters.prompt_aware_notion_formatter import (
    PromptAwareNotionFormatter,
    PromptMetadata,
    TrackedAnalyzerResult
)
from src.core.notion_client import NotionClient


class TestPromptAwareNotionFormatter:
    """Test suite for PromptAwareNotionFormatter."""
    
    @pytest.fixture
    def mock_notion_client(self):
        """Create mock Notion client."""
        mock = Mock(spec=NotionClient)
        mock.client = MagicMock()
        return mock
    
    @pytest.fixture
    def formatter(self, mock_notion_client):
        """Create formatter instance."""
        return PromptAwareNotionFormatter(mock_notion_client)
    
    @pytest.fixture
    def sample_metadata(self):
        """Create sample prompt metadata."""
        return PromptMetadata(
            analyzer_name="Test Analyzer",
            prompt_version="1.0",
            content_type="Technical Analysis",
            temperature=0.3,
            web_search_used=True,
            quality_score=0.85,
            processing_time=5.2,
            token_usage={"total_tokens": 1500, "prompt_tokens": 1000, "completion_tokens": 500},
            citations=[
                {"title": "Source 1", "url": "https://example.com/1", "domain": "example.com"},
                {"title": "Source 2", "url": "https://example.com/2", "domain": "example.com"}
            ],
            confidence_scores={"overall": 0.9, "classification": 0.85}
        )
    
    @pytest.fixture
    def sample_results(self, sample_metadata):
        """Create sample analyzer results."""
        return [
            TrackedAnalyzerResult(
                analyzer_name="Core Summarizer",
                content="This is a comprehensive summary of the document covering key points and insights.",
                metadata=sample_metadata,
                timestamp=datetime.now()
            ),
            TrackedAnalyzerResult(
                analyzer_name="Strategic Insights",
                content="• Immediate action: Implement new security protocols\n• Opportunity: Expand into emerging markets\n• Risk: Competitive pressure increasing",
                metadata=PromptMetadata(
                    analyzer_name="Strategic Insights",
                    prompt_version="1.0",
                    content_type="Business Strategy",
                    temperature=0.5,
                    web_search_used=False,
                    quality_score=0.75,
                    processing_time=4.1,
                    token_usage={"total_tokens": 1200},
                    confidence_scores={"overall": 0.8}
                ),
                timestamp=datetime.now()
            )
        ]
    
    def test_format_with_attribution(self, formatter, sample_metadata):
        """Test formatting with prompt attribution."""
        content = "This is test content for formatting."
        blocks = formatter.format_with_attribution(content, sample_metadata, "general")
        
        # Should have attribution header
        assert len(blocks) > 0
        assert blocks[0]["type"] == "callout"
        assert "Test Analyzer" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        assert "0.85" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        
        # Should have quality footer
        assert blocks[-1]["type"] == "divider"
    
    def test_create_executive_dashboard(self, formatter, sample_results):
        """Test executive dashboard creation."""
        blocks = formatter.create_executive_dashboard(sample_results)
        
        # Should have dashboard header
        assert any(b["type"] == "heading_1" and "Executive Intelligence Dashboard" in str(b) for b in blocks)
        
        # Should have metrics callout
        assert any(b["type"] == "callout" and "Analysis Overview" in str(b) for b in blocks)
        
        # Should have quality overview
        assert any(b["type"] == "code" for b in blocks)
        
        # Should have action items
        assert any(b["type"] == "toggle" and "Action Items" in str(b) for b in blocks)
    
    def test_create_prompt_attributed_section(self, formatter, sample_results):
        """Test creation of prompt-attributed sections."""
        result = sample_results[0]
        blocks = formatter.create_prompt_attributed_section(result)
        
        # Should have section header
        assert blocks[0]["type"] == "heading_2"
        assert "Core Summarizer" in blocks[0]["heading_2"]["rich_text"][0]["text"]["content"]
        
        # Should have prompt config callout
        assert any(b["type"] == "callout" and "Prompt Configuration" in str(b) for b in blocks)
        
        # Should have citations block
        assert any(b["type"] == "toggle" and "Sources" in str(b) for b in blocks)
        
        # Should have performance toggle
        assert any(b["type"] == "toggle" and "Performance Details" in str(b) for b in blocks)
    
    def test_optimize_for_mobile(self, formatter):
        """Test mobile optimization."""
        # Create blocks with table
        blocks = [
            {
                "type": "table",
                "table": {
                    "table_width": 3,
                    "has_column_header": True,
                    "children": []
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": "This is a very long paragraph that should be wrapped for mobile viewing to ensure readability on small screens"}}]
                }
            }
        ]
        
        mobile_blocks = formatter.optimize_for_mobile(blocks)
        
        # Table should be converted to cards
        assert mobile_blocks[0]["type"] == "callout"
        assert "cards for mobile" in mobile_blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        
        # Text should be wrapped
        paragraph_text = mobile_blocks[1]["paragraph"]["rich_text"][0]["text"]["content"]
        lines = paragraph_text.split("\n")
        assert all(len(line) <= formatter.mobile_line_length + 10 for line in lines)  # Allow some overflow
    
    def test_add_quality_indicators(self, formatter):
        """Test adding quality indicators to blocks."""
        # Test with high quality
        block = {
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "Test Heading"}}]
            }
        }
        
        enhanced_block = formatter.add_quality_indicators(block, 0.95)
        assert "⭐" in enhanced_block["heading_2"]["rich_text"][0]["text"]["content"]
        
        # Test with low quality
        low_quality_block = formatter.add_quality_indicators(block.copy(), 0.4)
        assert "⚠️" in low_quality_block["heading_2"]["rich_text"][0]["text"]["content"]
    
    def test_create_insight_connections(self, formatter, sample_results):
        """Test insight connection creation."""
        blocks = formatter.create_insight_connections(sample_results)
        
        # Should have connected insights header
        assert blocks[0]["type"] == "heading_2"
        assert "Connected Insights" in blocks[0]["heading_2"]["rich_text"][0]["text"]["content"]
        
        # Should have grouped insights
        assert any(b["type"] == "toggle" for b in blocks[1:])
    
    def test_extract_action_items(self, formatter):
        """Test action item extraction."""
        content = """
        Analysis results:
        • We should implement new security measures immediately
        • Market expansion must be considered for Q2
        • Regular monitoring is happening
        • Recommend updating the documentation
        • Next step: Schedule stakeholder meeting
        """
        
        actions = formatter._extract_action_items(content)
        
        assert len(actions) >= 4
        assert any("should implement" in action for action in actions)
        assert any("must be considered" in action for action in actions)
        assert any("Recommend updating" in action for action in actions)
        assert any("Next step" in action for action in actions)
    
    def test_determine_priority(self, formatter):
        """Test priority determination."""
        assert formatter._determine_priority("This is urgent and must be done immediately") == "high"
        assert formatter._determine_priority("We should consider this important task") == "medium"
        assert formatter._determine_priority("This is a regular task") == "low"
    
    def test_wrap_text(self, formatter):
        """Test text wrapping for mobile."""
        long_text = "This is a very long line of text that needs to be wrapped for mobile viewing to ensure proper readability on small screens"
        wrapped = formatter._wrap_text(long_text, 50)
        
        lines = wrapped.split("\n")
        assert all(len(line) <= 50 + 5 for line in lines)  # Allow small overflow
        assert len(lines) > 1  # Should be wrapped
    
    def test_extract_themes(self, formatter):
        """Test theme extraction."""
        text = """
        This document discusses AI and machine learning applications in data analytics.
        Security concerns are addressed regarding data privacy and protection.
        There are significant opportunities for growth and innovation in this space.
        Performance optimization remains a key focus area.
        """
        
        themes = formatter._extract_themes(text)
        
        assert len(themes) > 0
        assert any("AI/ML" in theme[0] for theme in themes)
        assert any("Security" in theme[0] for theme in themes)
        assert any("Data" in theme[0] for theme in themes)
    
    def test_format_different_content_types(self, formatter, sample_metadata):
        """Test formatting for different content types."""
        # Executive content
        exec_blocks = formatter.format_with_attribution(
            "Executive summary content", 
            sample_metadata, 
            "executive_dashboard"
        )
        assert any(b["type"] == "callout" and b["callout"]["color"] == "blue_background" for b in exec_blocks)
        
        # Insights content  
        insights_blocks = formatter.format_with_attribution(
            "• Immediate action needed\n• Growth opportunity identified\n• Risk factor detected",
            sample_metadata,
            "insights"
        )
        assert any(b["type"] == "toggle" for b in insights_blocks)
        
        # Technical content
        tech_blocks = formatter.format_with_attribution(
            "Technical analysis with code",
            sample_metadata,
            "technical_analysis"
        )
        assert any(b["type"] == "code" for b in tech_blocks)
    
    def test_empty_content_handling(self, formatter, sample_metadata):
        """Test handling of empty content."""
        blocks = formatter.format_with_attribution("", sample_metadata, "general")
        
        # Should still have attribution header and footer
        assert len(blocks) >= 2
        assert blocks[0]["type"] == "callout"  # Attribution header
        assert blocks[-1]["type"] == "divider"  # Footer
    
    def test_citation_formatting(self, formatter):
        """Test citation block creation."""
        citations = [
            {"title": "Research Paper 1", "url": "https://example.com/1", "domain": "example.com"},
            {"title": "Industry Report", "url": "https://example.com/2", "domain": "example.com"},
            {"title": "News Article", "url": "https://example.com/3", "domain": "news.com"}
        ]
        
        block = formatter._create_citations_block(citations)
        
        assert block["type"] == "toggle"
        assert "Sources (3)" in block["toggle"]["rich_text"][0]["text"]["content"]
        assert len(block["toggle"]["children"]) == 3
        
        # Check links are properly formatted
        for i, child in enumerate(block["toggle"]["children"]):
            assert child["type"] == "bulleted_list_item"
            assert citations[i]["url"] == child["bulleted_list_item"]["rich_text"][0].get("href")
    
    def test_quality_score_edge_cases(self, formatter):
        """Test quality score handling edge cases."""
        # Test with score = 0
        indicator = formatter._get_quality_indicator(0.0)
        assert indicator == formatter.quality_indicators["poor"]
        
        # Test with score = 1
        indicator = formatter._get_quality_indicator(1.0)
        assert indicator == formatter.quality_indicators["excellent"]
        
        # Test boundary values
        assert formatter._get_quality_indicator(0.89) == formatter.quality_indicators["good"]
        assert formatter._get_quality_indicator(0.90) == formatter.quality_indicators["excellent"]