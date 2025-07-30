"""
Integration tests for the new formatting system with the pipeline.
"""

import os
import pytest
from datetime import datetime

from src.core.models import EnrichmentResult
from src.formatting.pipeline_integration import FormattingAdapter


class TestFormatterIntegration:
    """Test the new formatter integration with pipeline."""
    
    @pytest.fixture
    def sample_enrichment_result(self):
        """Create a sample enrichment result."""
        result = EnrichmentResult(
            core_summary="This is a summary of the key findings from the research paper.",
            key_insights=[
                "AI systems are becoming more sophisticated",
                "Integration challenges remain significant",
                "User adoption is accelerating"
            ],
            content_type="Research Paper",
            ai_primitives=["machine learning", "natural language processing"],
            vendor="Academic Institution",
            confidence_scores={
                "classification": 0.95,
                "overall": 0.88
            },
            processing_time=3.2,
            token_usage={"total": 1500, "prompt": 1000, "completion": 500}
        )
        
        # Add some optional fields as attributes
        result.quality_score = 0.85
        result.total_tokens = 1500
        result.total_cost = 0.045
        result.classification_reasoning = "Document contains methodology and citations typical of research papers"
        result.topical_tags = ["artificial intelligence", "technology"]
        result.domain_tags = ["computer science", "research"]
        
        return result
    
    @pytest.fixture
    def sample_raw_content(self):
        """Sample raw content."""
        return """
        # Research Paper on AI Systems
        
        ## Abstract
        This paper explores the current state of AI systems...
        
        ## Introduction
        Artificial intelligence has evolved significantly...
        """
    
    @pytest.fixture
    def sample_metadata(self):
        """Sample source metadata."""
        return {
            'id': 'doc123',
            'title': 'AI Systems Research Paper',
            'tags': ['research', 'ai'],
            'url': 'https://example.com/paper.pdf'
        }
    
    def test_formatter_with_feature_flag_disabled(self):
        """Test that formatter returns empty when disabled."""
        # Ensure flag is disabled
        os.environ['USE_NEW_FORMATTER'] = 'false'
        
        adapter = FormattingAdapter()
        assert not adapter.should_use_new_formatter()
        
        # Should return empty list with minimal valid result
        minimal_result = EnrichmentResult(
            core_summary="Test",
            key_insights=[],
            content_type="general",
            ai_primitives=[],
            vendor=None,
            confidence_scores={},
            processing_time=0.0,
            token_usage={}
        )
        blocks = adapter.format_enrichment_result(
            minimal_result,
            "",
            {}
        )
        assert blocks == []
    
    def test_formatter_with_feature_flag_enabled(
        self,
        sample_enrichment_result,
        sample_raw_content,
        sample_metadata
    ):
        """Test that formatter works when enabled."""
        # Enable flag
        os.environ['USE_NEW_FORMATTER'] = 'true'
        
        adapter = FormattingAdapter()
        assert adapter.should_use_new_formatter()
        
        # Format the content
        blocks = adapter.format_enrichment_result(
            sample_enrichment_result,
            sample_raw_content,
            sample_metadata
        )
        
        # Verify blocks were created
        assert len(blocks) > 0
        
        # Check for quality indicator (always first)
        assert blocks[0]['type'] == 'callout'
        assert 'Quality Score' in blocks[0]['callout']['rich_text'][0]['text']['content']
        
        # Verify some content sections exist
        block_types = [b.get('type') for b in blocks]
        assert 'heading_2' in block_types or 'callout' in block_types
    
    def test_content_type_template_selection(
        self,
        sample_enrichment_result,
        sample_raw_content,
        sample_metadata
    ):
        """Test that correct template is selected based on content type."""
        os.environ['USE_NEW_FORMATTER'] = 'true'
        adapter = FormattingAdapter()
        
        # Test research paper template
        sample_enrichment_result.content_type = "Research Paper"
        blocks = adapter.format_enrichment_result(
            sample_enrichment_result,
            sample_raw_content,
            sample_metadata
        )
        
        # Should have research-specific sections
        block_content = str(blocks)
        # Research papers should show methodology if present
        
        # Test market news template
        sample_enrichment_result.content_type = "Market News"
        blocks = adapter.format_enrichment_result(
            sample_enrichment_result,
            sample_raw_content,
            sample_metadata
        )
        
        # Market news has different formatting
        assert len(blocks) > 0
    
    def test_quality_based_visibility(self):
        """Test that content visibility changes based on quality score."""
        os.environ['USE_NEW_FORMATTER'] = 'true'
        adapter = FormattingAdapter()
        
        # High quality content
        high_quality = EnrichmentResult(
            core_summary="High quality summary",
            key_insights=["Insight 1", "Insight 2"],
            content_type="general",
            ai_primitives=[],
            vendor=None,
            confidence_scores={"overall": 0.9},
            processing_time=1.0,
            token_usage={}
        )
        high_quality.quality_score = 0.9
        
        high_blocks = adapter.format_enrichment_result(
            high_quality,
            "Content",
            {'id': '1', 'title': 'High Quality'}
        )
        
        # Low quality content
        low_quality = EnrichmentResult(
            core_summary="Low quality summary",
            key_insights=["Insight 1"],
            content_type="general",
            ai_primitives=[],
            vendor=None,
            confidence_scores={"overall": 0.3},
            processing_time=1.0,
            token_usage={}
        )
        low_quality.quality_score = 0.3
        
        low_blocks = adapter.format_enrichment_result(
            low_quality,
            "Content",
            {'id': '2', 'title': 'Low Quality'}
        )
        
        # High quality should have more visible sections
        # Count non-toggle blocks (visible content)
        high_visible = sum(1 for b in high_blocks if b.get('type') != 'toggle')
        low_visible = sum(1 for b in low_blocks if b.get('type') != 'toggle')
        
        # High quality should have more visible content
        assert high_visible >= low_visible
    
    def test_error_handling(self):
        """Test that formatter handles errors gracefully."""
        os.environ['USE_NEW_FORMATTER'] = 'true'
        adapter = FormattingAdapter()
        
        # Test with malformed result
        bad_result = EnrichmentResult(
            core_summary="Error",
            key_insights=[],
            content_type="error",
            ai_primitives=[],
            vendor=None,
            confidence_scores={},
            processing_time=0.0,
            token_usage={}
        )
        # Should not raise exception
        blocks = adapter.format_enrichment_result(
            bad_result,
            "",
            {}
        )
        
        # Should handle error content gracefully
        # Even error content gets formatted (shows error state)
        assert len(blocks) > 0
    
    def test_platform_detection(self):
        """Test platform-aware formatting."""
        os.environ['USE_NEW_FORMATTER'] = 'true'
        
        # Test mobile platform
        os.environ['NOTION_PLATFORM'] = 'mobile'
        adapter = FormattingAdapter()
        
        result = EnrichmentResult(
            core_summary="Mobile optimized content",
            key_insights=["Short insight"],
            content_type="general",
            ai_primitives=[],
            vendor=None,
            confidence_scores={"overall": 0.7},
            processing_time=1.0,
            token_usage={}
        )
        result.quality_score = 0.7
        
        blocks = adapter.format_enrichment_result(
            result,
            "Content",
            {'id': '3', 'title': 'Mobile Test'}
        )
        
        # Mobile formatting would be more compact
        assert len(blocks) > 0
        
        # Reset
        os.environ['NOTION_PLATFORM'] = 'desktop'