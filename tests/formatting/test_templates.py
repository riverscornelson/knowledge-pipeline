"""Tests for template system."""

import pytest
from datetime import datetime
from typing import List, Dict, Any

from src.formatting.templates import ContentTemplate, TemplateRegistry
from src.formatting.models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    Insight,
    ProcessingMetrics
)


class MockTemplate(ContentTemplate):
    """Mock template for testing base functionality."""
    
    def get_template_name(self) -> str:
        return "mock_template"
    
    def get_supported_content_types(self) -> List[str]:
        return ["mock_type", "test_type"]
    
    def get_section_order(self) -> List[str]:
        return ["executive_summary", "key_insights", "action_items"]
    
    def format_section(
        self,
        section: str,
        content: Any,
        enriched_content: EnrichedContent
    ) -> List[Dict[str, Any]]:
        """Simple mock formatting."""
        return [{
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": f"Mock: {section} - {str(content)[:50]}"}
                    }
                ]
            }
        }]


class TestContentTemplate:
    """Test ContentTemplate base class functionality."""
    
    @pytest.fixture
    def mock_template(self):
        """Create a mock template instance."""
        return MockTemplate()
    
    @pytest.fixture
    def sample_content(self):
        """Create sample enriched content."""
        return EnrichedContent(
            content_type="mock_type",
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
                ActionItem(text="Do this", priority=ActionPriority.HIGH)
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
            )
        )
    
    def test_should_show_section_always_visible(self, mock_template, sample_content):
        """Test sections that are always visible."""
        # Always visible sections
        assert mock_template.should_show_section("executive_summary", sample_content) is True
        assert mock_template.should_show_section("action_items", sample_content) is True
        assert mock_template.should_show_section("quality_indicator", sample_content) is True
    
    def test_should_show_section_quality_thresholds(self, mock_template, sample_content):
        """Test quality-based section visibility."""
        # High quality content (0.85) should show these
        assert mock_template.should_show_section("detailed_analysis", sample_content) is True
        assert mock_template.should_show_section("strategic_implications", sample_content) is True
        
        # Technical details require higher quality (0.8)
        assert mock_template.should_show_section("technical_details", sample_content) is True
        
        # Always hidden in toggles
        assert mock_template.should_show_section("raw_content", sample_content) is False
        assert mock_template.should_show_section("processing_metadata", sample_content) is False
    
    def test_should_show_section_low_quality(self, mock_template):
        """Test visibility with low quality content."""
        low_quality_content = EnrichedContent(
            content_type="mock_type",
            source_id="test",
            source_title="Test",
            quality_score=0.4,
            quality_level=ContentQuality.LOW,
            executive_summary=["Summary"],
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
        
        # Low quality hides most sections
        assert mock_template.should_show_section("detailed_analysis", low_quality_content) is False
        assert mock_template.should_show_section("strategic_implications", low_quality_content) is False
        
        # But always visible sections remain
        assert mock_template.should_show_section("executive_summary", low_quality_content) is True
    
    def test_critical_actions_override(self, mock_template):
        """Test critical actions override quality thresholds."""
        critical_content = EnrichedContent(
            content_type="mock_type",
            source_id="test",
            source_title="Test",
            quality_score=0.4,  # Low quality
            quality_level=ContentQuality.LOW,
            executive_summary=["Summary"],
            key_insights=[],
            action_items=[
                ActionItem(text="CRITICAL!", priority=ActionPriority.CRITICAL)
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
                quality_score=0.4,
                confidence_score=0.5
            )
        )
        
        # Critical actions override quality for strategic implications
        assert mock_template.should_show_section("strategic_implications", critical_content) is True
    
    def test_get_section_icon(self, mock_template):
        """Test icon retrieval for sections."""
        assert mock_template.get_section_icon("executive_summary") == "📋"
        assert mock_template.get_section_icon("key_insights") == "💡"
        assert mock_template.get_section_icon("action_items") == "⚡"
        assert mock_template.get_section_icon("risk_assessment") == "⚠️"
        assert mock_template.get_section_icon("unknown_section") == "📌"  # Default
    
    def test_get_quality_indicator(self, mock_template, sample_content):
        """Test quality indicator generation."""
        indicator = mock_template.get_quality_indicator(sample_content)
        
        assert indicator["type"] == "callout"
        assert "Quality Score" in indicator["callout"]["rich_text"][0]["text"]["content"]
        assert "85%" in indicator["callout"]["rich_text"][0]["text"]["content"]
        assert indicator["callout"]["color"] == "blue_background"  # HIGH quality
        assert indicator["callout"]["icon"]["emoji"] == "✨"  # HIGH quality emoji
    
    def test_quality_bar_creation(self, mock_template):
        """Test visual quality bar generation."""
        assert mock_template._create_quality_bar(1.0) == "██████████"
        assert mock_template._create_quality_bar(0.5) == "█████░░░░░"
        assert mock_template._create_quality_bar(0.0) == "░░░░░░░░░░"
        assert mock_template._create_quality_bar(0.85) == "████████░░"
    
    def test_quality_emoji_mapping(self, mock_template):
        """Test quality level to emoji mapping."""
        assert mock_template._get_quality_emoji(ContentQuality.EXCELLENT) == "⭐"
        assert mock_template._get_quality_emoji(ContentQuality.HIGH) == "✨"
        assert mock_template._get_quality_emoji(ContentQuality.MEDIUM) == "✓"
        assert mock_template._get_quality_emoji(ContentQuality.LOW) == "⚠️"
    
    def test_quality_color_mapping(self, mock_template):
        """Test quality level to color mapping."""
        assert mock_template._get_quality_color(ContentQuality.EXCELLENT) == "green_background"
        assert mock_template._get_quality_color(ContentQuality.HIGH) == "blue_background"
        assert mock_template._get_quality_color(ContentQuality.MEDIUM) == "yellow_background"
        assert mock_template._get_quality_color(ContentQuality.LOW) == "red_background"
    
    def test_priority_emoji_mapping(self, mock_template):
        """Test action priority to emoji mapping."""
        assert mock_template._get_priority_emoji(ActionPriority.CRITICAL) == "🔴"
        assert mock_template._get_priority_emoji(ActionPriority.HIGH) == "🟡"
        assert mock_template._get_priority_emoji(ActionPriority.MEDIUM) == "🟢"
        assert mock_template._get_priority_emoji(ActionPriority.LOW) == "⚪"


class TestTemplateRegistry:
    """Test TemplateRegistry functionality."""
    
    def setup_method(self):
        """Clear registry before each test."""
        TemplateRegistry._templates = {}
        TemplateRegistry._content_type_map = {}
    
    def test_register_template(self):
        """Test template registration."""
        template = MockTemplate()
        TemplateRegistry.register(template)
        
        # Check template is registered
        assert "mock_template" in TemplateRegistry._templates
        assert TemplateRegistry._templates["mock_template"] == template
        
        # Check content type mapping
        assert TemplateRegistry._content_type_map["mock_type"] == "mock_template"
        assert TemplateRegistry._content_type_map["test_type"] == "mock_template"
    
    def test_get_template_by_content_type(self):
        """Test template retrieval by content type."""
        template = MockTemplate()
        TemplateRegistry.register(template)
        
        # Should get the registered template
        retrieved = TemplateRegistry.get_template("mock_type")
        assert retrieved == template
        
        retrieved = TemplateRegistry.get_template("test_type")
        assert retrieved == template
    
    def test_get_template_unknown_type(self):
        """Test template retrieval for unknown content type."""
        # Register a general template as fallback
        general_template = MockTemplate()
        general_template.get_template_name = lambda: "general"
        TemplateRegistry.register(general_template)
        
        # Unknown type should return general template
        retrieved = TemplateRegistry.get_template("unknown_type")
        assert retrieved == general_template
    
    def test_get_template_no_fallback(self):
        """Test template retrieval with no general fallback."""
        template = MockTemplate()
        TemplateRegistry.register(template)
        
        # Unknown type with no general template returns None
        retrieved = TemplateRegistry.get_template("unknown_type")
        assert retrieved is None
    
    def test_list_templates(self):
        """Test listing registered templates."""
        template1 = MockTemplate()
        template1.get_template_name = lambda: "template1"
        template2 = MockTemplate()
        template2.get_template_name = lambda: "template2"
        
        TemplateRegistry.register(template1)
        TemplateRegistry.register(template2)
        
        templates = TemplateRegistry.list_templates()
        assert len(templates) == 2
        assert "template1" in templates
        assert "template2" in templates
    
    def test_list_content_types(self):
        """Test listing supported content types."""
        template = MockTemplate()
        TemplateRegistry.register(template)
        
        content_types = TemplateRegistry.list_content_types()
        assert len(content_types) == 2
        assert "mock_type" in content_types
        assert "test_type" in content_types
    
    def test_multiple_templates_different_types(self):
        """Test multiple templates with different content types."""
        template1 = MockTemplate()
        template1.get_template_name = lambda: "template1"
        template1.get_supported_content_types = lambda: ["type1", "type2"]
        
        template2 = MockTemplate()
        template2.get_template_name = lambda: "template2"
        template2.get_supported_content_types = lambda: ["type3", "type4"]
        
        TemplateRegistry.register(template1)
        TemplateRegistry.register(template2)
        
        # Each type maps to correct template
        assert TemplateRegistry.get_template("type1") == template1
        assert TemplateRegistry.get_template("type2") == template1
        assert TemplateRegistry.get_template("type3") == template2
        assert TemplateRegistry.get_template("type4") == template2