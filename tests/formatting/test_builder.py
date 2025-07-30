"""Tests for adaptive block builder."""

import pytest
from datetime import datetime

from src.formatting.builder import AdaptiveBlockBuilder, Platform
from src.formatting.content_templates import GeneralContentTemplate, MarketNewsTemplate
from src.formatting.models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    Insight,
    ProcessingMetrics
)


class TestPlatformSettings:
    """Test platform-specific settings."""
    
    def test_desktop_settings(self):
        """Test desktop platform settings."""
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        
        assert builder.platform == Platform.DESKTOP
        assert builder.settings["max_line_length"] == 120
        assert builder.settings["use_columns"] is True
        assert builder.settings["use_tables"] is True
        assert builder.settings["callout_style"] == "full"
    
    def test_mobile_settings(self):
        """Test mobile platform settings."""
        builder = AdaptiveBlockBuilder(Platform.MOBILE)
        
        assert builder.platform == Platform.MOBILE
        assert builder.settings["max_line_length"] == 40
        assert builder.settings["use_columns"] is False
        assert builder.settings["use_tables"] is False
        assert builder.settings["callout_style"] == "compact"
    
    def test_tablet_settings(self):
        """Test tablet platform settings."""
        builder = AdaptiveBlockBuilder(Platform.TABLET)
        
        assert builder.platform == Platform.TABLET
        assert builder.settings["max_line_length"] == 80
        assert builder.settings["use_columns"] is True
        assert builder.settings["use_tables"] is True
        assert builder.settings["callout_style"] == "full"


class TestAdaptiveBlockBuilder:
    """Test AdaptiveBlockBuilder functionality."""
    
    @pytest.fixture
    def desktop_builder(self):
        """Create desktop builder."""
        return AdaptiveBlockBuilder(Platform.DESKTOP)
    
    @pytest.fixture
    def mobile_builder(self):
        """Create mobile builder."""
        return AdaptiveBlockBuilder(Platform.MOBILE)
    
    @pytest.fixture
    def sample_content(self):
        """Create sample enriched content."""
        return EnrichedContent(
            content_type="general",
            source_id="test123",
            source_title="Test Document",
            quality_score=0.85,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Point 1", "Point 2"],
            key_insights=[
                Insight(text="Insight 1", confidence=0.9),
                Insight(text="Insight 2", confidence=0.8)
            ],
            action_items=[
                ActionItem(text="Critical task", priority=ActionPriority.CRITICAL),
                ActionItem(text="Medium task", priority=ActionPriority.MEDIUM)
            ],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="test",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.85,
                confidence_score=0.9
            ),
            raw_sections={
                "detailed_analysis": "This is a detailed analysis",
                "custom_section": {"data": "value"}
            },
            raw_content="Raw content here"
        )
    
    @pytest.fixture
    def low_quality_content(self):
        """Create low quality content."""
        return EnrichedContent(
            content_type="general",
            source_id="test123",
            source_title="Test Document",
            quality_score=0.4,
            quality_level=ContentQuality.LOW,
            executive_summary=["Low quality summary"],
            key_insights=[],
            action_items=[],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="test",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.4,
                confidence_score=0.5
            )
        )
    
    @pytest.fixture
    def template(self):
        """Create template instance."""
        return GeneralContentTemplate()
    
    def test_build_blocks_basic(self, desktop_builder, sample_content, template):
        """Test basic block building."""
        blocks = desktop_builder.build_blocks(sample_content, template)
        
        # Should have quality indicator first
        assert blocks[0]["type"] == "callout"
        assert "Quality Score" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        
        # Should have visible sections
        block_types = [b.get("type") for b in blocks]
        assert "heading_2" in block_types  # Section headers
        assert "bulleted_list_item" in block_types  # Executive summary
        assert "to_do" in block_types  # Action items (critical actions visible)
    
    def test_build_blocks_force_minimal(self, desktop_builder, sample_content, template):
        """Test minimal mode."""
        blocks = desktop_builder.build_blocks(sample_content, template, force_minimal=True)
        
        # Should have fewer blocks
        block_types = [b.get("type") for b in blocks]
        
        # Only essential sections visible
        # Quality indicator and executive summary should be there
        callout_blocks = [b for b in blocks if b.get("type") == "callout"]
        assert len(callout_blocks) >= 1  # At least quality indicator
        
        # No toggles in minimal mode for non-essential content
        toggle_blocks = [b for b in blocks if b.get("type") == "toggle"]
        assert len(toggle_blocks) == 0 or all(
            "raw_content" in b["toggle"]["rich_text"][0]["text"]["content"].lower() or
            "processing" in b["toggle"]["rich_text"][0]["text"]["content"].lower()
            for b in toggle_blocks
        )
    
    def test_get_section_content(self, desktop_builder, sample_content):
        """Test section content retrieval."""
        # Core sections
        assert desktop_builder._get_section_content(sample_content, "executive_summary") == sample_content.executive_summary
        assert desktop_builder._get_section_content(sample_content, "key_insights") == sample_content.key_insights
        assert desktop_builder._get_section_content(sample_content, "action_items") == sample_content.action_items
        assert desktop_builder._get_section_content(sample_content, "raw_content") == sample_content.raw_content
        assert desktop_builder._get_section_content(sample_content, "attribution") == sample_content.attribution
        assert desktop_builder._get_section_content(sample_content, "processing_metadata") == sample_content.processing_metrics
        
        # Raw sections
        assert desktop_builder._get_section_content(sample_content, "detailed_analysis") == "This is a detailed analysis"
        assert desktop_builder._get_section_content(sample_content, "custom_section") == {"data": "value"}
        
        # Non-existent section
        assert desktop_builder._get_section_content(sample_content, "non_existent") is None
        
        # Special sections
        assert desktop_builder._get_section_content(sample_content, "quality_indicator") is None
    
    def test_build_visible_section(self, desktop_builder, sample_content, template):
        """Test visible section building."""
        section_content = sample_content.executive_summary
        blocks = desktop_builder._build_visible_section(
            "executive_summary",
            section_content,
            sample_content,
            template
        )
        
        # Should have header and content
        assert blocks[0]["type"] == "heading_2"
        assert "📋 Executive Summary" in blocks[0]["heading_2"]["rich_text"][0]["text"]["content"]
        
        # Content blocks follow
        assert all(b["type"] == "bulleted_list_item" for b in blocks[1:])
    
    def test_build_visible_section_with_callout(self, desktop_builder, sample_content, template):
        """Test visible section as callout (e.g., critical actions)."""
        blocks = desktop_builder._build_visible_section(
            "action_items",
            sample_content.action_items,
            sample_content,
            template
        )
        
        # Critical actions should be in callout
        assert any(b["type"] == "callout" for b in blocks)
    
    def test_build_toggle_section(self, desktop_builder, sample_content, template):
        """Test toggle section building."""
        toggle = desktop_builder._build_toggle_section(
            "raw_content",
            sample_content.raw_content,
            sample_content,
            template
        )
        
        assert toggle is not None
        assert toggle["type"] == "toggle"
        assert "📄 Raw Content" in toggle["toggle"]["rich_text"][0]["text"]["content"]
        assert len(toggle["toggle"]["children"]) > 0
    
    def test_build_toggle_section_with_size_warning(self, desktop_builder, template):
        """Test toggle with size warning for large content."""
        large_content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=[],
            key_insights=[],
            action_items=[],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="test",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.8,
                confidence_score=0.9
            ),
            raw_content="x" * 100,
            raw_content_size_bytes=2_000_000  # 2MB
        )
        
        toggle = desktop_builder._build_toggle_section(
            "raw_content",
            large_content.raw_content,
            large_content,
            template
        )
        
        assert "(1.9 MB)" in toggle["toggle"]["rich_text"][0]["text"]["content"]
    
    def test_build_toggle_section_none_content(self, desktop_builder, sample_content, template):
        """Test toggle with None content returns None."""
        toggle = desktop_builder._build_toggle_section(
            "non_existent",
            None,
            sample_content,
            template
        )
        
        assert toggle is None
    
    def test_build_callout_section_desktop(self, desktop_builder, sample_content, template):
        """Test callout section for desktop (full style)."""
        blocks = desktop_builder._build_callout_section(
            "⚡",
            "Action Items",
            sample_content.action_items,
            sample_content,
            template,
            "action_items"
        )
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "callout"
        assert blocks[0]["callout"]["icon"]["emoji"] == "⚡"
        assert blocks[0]["callout"]["color"] == "red_background"  # Critical actions
        assert "children" in blocks[0]["callout"]  # Full style has children
    
    def test_build_callout_section_mobile(self, mobile_builder, sample_content, template):
        """Test callout section for mobile (compact style)."""
        blocks = mobile_builder._build_callout_section(
            "⚡",
            "Action Items",
            sample_content.action_items,
            sample_content,
            template,
            "action_items"
        )
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "callout"
        # Compact style combines header and content
        assert "Action Items:" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        assert blocks[0]["callout"]["rich_text"][0]["annotations"]["bold"] is True
    
    def test_format_section_header(self, desktop_builder):
        """Test section header formatting."""
        assert desktop_builder._format_section_header("executive_summary") == "Executive Summary"
        assert desktop_builder._format_section_header("key_insights") == "Key Insights"
        assert desktop_builder._format_section_header("action_items") == "Action Items"
        assert desktop_builder._format_section_header("raw_content") == "Raw Content"
    
    def test_get_callout_color(self, desktop_builder, sample_content):
        """Test callout color determination."""
        # Critical actions -> red
        assert desktop_builder._get_callout_color("action_items", sample_content) == "red_background"
        
        # Risk assessment -> yellow
        assert desktop_builder._get_callout_color("risk_assessment", sample_content) == "yellow_background"
        
        # Market impact -> blue
        assert desktop_builder._get_callout_color("market_impact", sample_content) == "blue_background"
        
        # Default -> gray
        assert desktop_builder._get_callout_color("other_section", sample_content) == "gray_background"
    
    def test_create_header_block(self, desktop_builder):
        """Test header block creation."""
        # Level 2 header
        header = desktop_builder._create_header_block("Test Header", 2)
        assert header["type"] == "heading_2"
        assert header["heading_2"]["rich_text"][0]["text"]["content"] == "Test Header"
        
        # Level 1 header
        header = desktop_builder._create_header_block("Title", 1)
        assert header["type"] == "heading_1"
        
        # Invalid level defaults to 3
        header = desktop_builder._create_header_block("Subheading", 5)
        assert header["type"] == "heading_3"
    
    def test_add_section_spacing(self, desktop_builder):
        """Test section spacing logic."""
        blocks = [
            {"type": "callout"},
            {"type": "heading_2"},
            {"type": "paragraph"},
            {"type": "toggle"},
            {"type": "callout"}
        ]
        
        spaced = desktop_builder._add_section_spacing(blocks)
        
        # Should add dividers between major sections
        divider_count = sum(1 for b in spaced if b.get("type") == "divider")
        assert divider_count > 0
    
    def test_should_add_spacing(self, desktop_builder):
        """Test spacing decision logic."""
        # Major sections should have spacing
        assert desktop_builder._should_add_spacing(
            {"type": "callout"},
            {"type": "callout"}
        ) is True
        
        assert desktop_builder._should_add_spacing(
            {"type": "toggle"},
            {"type": "heading_2"}
        ) is True
        
        # Paragraphs don't need spacing
        assert desktop_builder._should_add_spacing(
            {"type": "paragraph"},
            {"type": "paragraph"}
        ) is False
    
    def test_optimize_for_platform_desktop(self, desktop_builder):
        """Test desktop platform optimization (no changes)."""
        blocks = [
            {"type": "table", "table": {}},
            {"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Text"}}]}}
        ]
        
        optimized = desktop_builder._optimize_for_platform(blocks)
        
        # Desktop keeps tables
        assert optimized[0]["type"] == "table"
        assert len(optimized) == len(blocks)
    
    def test_optimize_for_platform_mobile(self, mobile_builder):
        """Test mobile platform optimization."""
        blocks = [
            {"type": "table", "table": {}},
            {"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Long text"}}]}}
        ]
        
        optimized = mobile_builder._optimize_for_platform(blocks)
        
        # Mobile converts tables (for now returns as-is)
        # This is a placeholder for future table->card conversion
        assert len(optimized) == len(blocks)
    
    def test_combine_header_and_content(self, desktop_builder):
        """Test header and content combination for compact display."""
        content_blocks = [{
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": "First content item"}}
                ]
            }
        }]
        
        rich_text = desktop_builder._combine_header_and_content("Header", content_blocks)
        
        assert len(rich_text) >= 2
        assert rich_text[0]["text"]["content"] == "Header: "
        assert rich_text[0]["annotations"]["bold"] is True
        assert rich_text[1]["text"]["content"] == "First content item"
    
    def test_full_pipeline_with_toggles(self, desktop_builder, low_quality_content, template):
        """Test full pipeline with low quality content (more toggles)."""
        blocks = desktop_builder.build_blocks(low_quality_content, template)
        
        # Low quality content should have more toggles
        toggle_blocks = [b for b in blocks if b.get("type") == "toggle"]
        assert len(toggle_blocks) > 0
        
        # But executive summary still visible
        has_exec_summary = any(
            "Executive Summary" in str(b) for b in blocks
        )
        assert has_exec_summary
    
    def test_market_news_template_integration(self, desktop_builder):
        """Test integration with market news template."""
        content = EnrichedContent(
            content_type="market_news",
            source_id="news123",
            source_title="Market Update",
            quality_score=0.9,
            quality_level=ContentQuality.EXCELLENT,
            executive_summary=["Major market movement"],
            key_insights=[],
            action_items=[
                ActionItem(text="Review positions", priority=ActionPriority.HIGH)
            ],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="test",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.9,
                confidence_score=0.95
            ),
            raw_sections={
                "market_impact": "High impact on tech sector",
                "affected_parties": ["AAPL", "GOOGL", "MSFT"]
            }
        )
        
        template = MarketNewsTemplate()
        blocks = desktop_builder.build_blocks(content, template)
        
        # Should have market-specific sections
        block_content = str(blocks)
        assert "Market Impact" in block_content or "market_impact" in block_content