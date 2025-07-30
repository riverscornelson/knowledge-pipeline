"""Tests for formatting models."""

import pytest
from datetime import datetime

from src.formatting.models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    Insight,
    ProcessingMetrics
)


class TestContentQuality:
    """Test ContentQuality enum and calculations."""
    
    def test_quality_level_calculation(self):
        """Test quality level calculation from scores."""
        assert EnrichedContent.calculate_quality_level(0.95) == ContentQuality.EXCELLENT
        assert EnrichedContent.calculate_quality_level(0.85) == ContentQuality.HIGH
        assert EnrichedContent.calculate_quality_level(0.65) == ContentQuality.MEDIUM
        assert EnrichedContent.calculate_quality_level(0.45) == ContentQuality.LOW
        
    def test_quality_edge_cases(self):
        """Test edge cases for quality calculation."""
        assert EnrichedContent.calculate_quality_level(0.9) == ContentQuality.EXCELLENT
        assert EnrichedContent.calculate_quality_level(0.7) == ContentQuality.HIGH
        assert EnrichedContent.calculate_quality_level(0.5) == ContentQuality.MEDIUM
        assert EnrichedContent.calculate_quality_level(0.0) == ContentQuality.LOW
        
    def test_quality_boundary_values(self):
        """Test exact boundary values for quality levels."""
        # Test exact boundaries
        assert EnrichedContent.calculate_quality_level(1.0) == ContentQuality.EXCELLENT
        assert EnrichedContent.calculate_quality_level(0.899) == ContentQuality.HIGH  # Just below EXCELLENT
        assert EnrichedContent.calculate_quality_level(0.699) == ContentQuality.MEDIUM  # Just below HIGH
        assert EnrichedContent.calculate_quality_level(0.499) == ContentQuality.LOW  # Just below MEDIUM
        
    def test_quality_invalid_values(self):
        """Test handling of invalid quality scores."""
        # Should clamp to valid range
        assert EnrichedContent.calculate_quality_level(1.5) == ContentQuality.EXCELLENT
        assert EnrichedContent.calculate_quality_level(-0.5) == ContentQuality.LOW
        
    def test_quality_enum_values(self):
        """Test ContentQuality enum string values."""
        assert ContentQuality.EXCELLENT.value == "excellent"
        assert ContentQuality.HIGH.value == "high"
        assert ContentQuality.MEDIUM.value == "medium"
        assert ContentQuality.LOW.value == "low"


class TestActionItem:
    """Test ActionItem model."""
    
    def test_action_creation(self):
        """Test creating action items."""
        action = ActionItem(
            text="Review market analysis",
            priority=ActionPriority.HIGH,
            due_date=datetime(2024, 12, 31),
            assignee="John Doe"
        )
        
        assert action.text == "Review market analysis"
        assert action.priority == ActionPriority.HIGH
        assert action.due_date.year == 2024
        assert action.assignee == "John Doe"
    
    def test_action_priority_levels(self):
        """Test all priority levels."""
        priorities = [
            ActionPriority.CRITICAL,
            ActionPriority.HIGH,
            ActionPriority.MEDIUM,
            ActionPriority.LOW
        ]
        
        for priority in priorities:
            action = ActionItem(text="Test", priority=priority)
            assert action.priority == priority
    
    def test_action_optional_fields(self):
        """Test action items with optional fields."""
        # Minimal action
        action = ActionItem(text="Simple task", priority=ActionPriority.MEDIUM)
        assert action.text == "Simple task"
        assert action.priority == ActionPriority.MEDIUM
        assert action.due_date is None
        assert action.assignee is None
        assert action.context is None
        
        # With context
        action = ActionItem(
            text="Complex task",
            priority=ActionPriority.HIGH,
            context="Related to Q4 planning"
        )
        assert action.context == "Related to Q4 planning"
    
    def test_action_priority_enum_values(self):
        """Test ActionPriority enum string values."""
        assert ActionPriority.CRITICAL.value == "critical"
        assert ActionPriority.HIGH.value == "high"
        assert ActionPriority.MEDIUM.value == "medium"
        assert ActionPriority.LOW.value == "low"


class TestInsight:
    """Test Insight model."""
    
    def test_insight_creation(self):
        """Test creating insights."""
        insight = Insight(
            text="Market is shifting towards renewable energy",
            confidence=0.85,
            supporting_evidence="Based on 15 industry reports",
            tags=["energy", "market", "renewable"]
        )
        
        assert insight.text == "Market is shifting towards renewable energy"
        assert insight.confidence == 0.85
        assert insight.supporting_evidence == "Based on 15 industry reports"
        assert "energy" in insight.tags
    
    def test_insight_defaults(self):
        """Test default values for insights."""
        insight = Insight(text="Simple insight")
        
        assert insight.confidence == 1.0
        assert insight.supporting_evidence is None
        assert insight.tags == []
    
    def test_insight_confidence_bounds(self):
        """Test insight confidence score bounds."""
        # Valid confidence scores
        insight = Insight(text="Test", confidence=0.0)
        assert insight.confidence == 0.0
        
        insight = Insight(text="Test", confidence=0.5)
        assert insight.confidence == 0.5
        
        insight = Insight(text="Test", confidence=1.0)
        assert insight.confidence == 1.0
    
    def test_insight_with_empty_tags(self):
        """Test insight with empty tags list."""
        insight = Insight(text="Test", tags=[])
        assert insight.tags == []
        
        # With None tags (should default to empty list)
        insight = Insight(text="Test", tags=None)
        assert insight.tags is None or insight.tags == []


class TestEnrichedContent:
    """Test EnrichedContent model."""
    
    @pytest.fixture
    def sample_attribution(self):
        """Create sample attribution."""
        return Attribution(
            prompt_name="market_analysis",
            prompt_version="2.0",
            prompt_source="notion",
            analyzer_name="market_analyzer",
            analyzer_version="1.5",
            model_used="gpt-4",
            processing_timestamp=datetime.now()
        )
    
    @pytest.fixture
    def sample_metrics(self):
        """Create sample processing metrics."""
        return ProcessingMetrics(
            processing_time_seconds=5.2,
            tokens_used=1500,
            estimated_cost=0.045,
            quality_score=0.85,
            confidence_score=0.9,
            cache_hit=False
        )
    
    def test_enriched_content_creation(self, sample_attribution, sample_metrics):
        """Test creating enriched content."""
        content = EnrichedContent(
            content_type="market_news",
            source_id="doc123",
            source_title="Q4 Market Report",
            quality_score=0.85,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Point 1", "Point 2", "Point 3"],
            key_insights=[
                Insight(text="Insight 1", confidence=0.9),
                Insight(text="Insight 2", confidence=0.8)
            ],
            action_items=[
                ActionItem(text="Action 1", priority=ActionPriority.HIGH),
                ActionItem(text="Action 2", priority=ActionPriority.MEDIUM)
            ],
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        assert content.content_type == "market_news"
        assert content.source_id == "doc123"
        assert len(content.executive_summary) == 3
        assert len(content.key_insights) == 2
        assert len(content.action_items) == 2
    
    def test_has_critical_actions(self, sample_attribution, sample_metrics):
        """Test critical action detection."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=[],
            key_insights=[],
            action_items=[
                ActionItem(text="Critical", priority=ActionPriority.CRITICAL),
                ActionItem(text="Medium", priority=ActionPriority.MEDIUM)
            ],
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        assert content.has_critical_actions() is True
        assert content.has_high_priority_actions() is True
    
    def test_has_high_priority_actions(self, sample_attribution, sample_metrics):
        """Test high priority action detection."""
        # Test with only high priority
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=[],
            key_insights=[],
            action_items=[
                ActionItem(text="High", priority=ActionPriority.HIGH),
                ActionItem(text="Low", priority=ActionPriority.LOW)
            ],
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        assert content.has_critical_actions() is False
        assert content.has_high_priority_actions() is True
        
        # Test with no high priority
        content.action_items = [
            ActionItem(text="Medium", priority=ActionPriority.MEDIUM),
            ActionItem(text="Low", priority=ActionPriority.LOW)
        ]
        
        assert content.has_high_priority_actions() is False
    
    def test_empty_content_handling(self, sample_attribution, sample_metrics):
        """Test handling of empty content sections."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.5,
            quality_level=ContentQuality.MEDIUM,
            executive_summary=[],  # Empty
            key_insights=[],  # Empty
            action_items=[],  # Empty
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        assert len(content.executive_summary) == 0
        assert len(content.key_insights) == 0
        assert len(content.action_items) == 0
        assert content.has_critical_actions() is False
        assert content.has_high_priority_actions() is False
    
    def test_raw_content_size_tracking(self, sample_attribution, sample_metrics):
        """Test raw content size tracking."""
        # With raw content
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary"],
            key_insights=[],
            action_items=[],
            attribution=sample_attribution,
            processing_metrics=sample_metrics,
            raw_content="x" * 1000,
            raw_content_size_bytes=1000
        )
        
        assert content.raw_content == "x" * 1000
        assert content.raw_content_size_bytes == 1000
        
        # Without raw content
        content2 = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary"],
            key_insights=[],
            action_items=[],
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        assert content2.raw_content is None
        assert content2.raw_content_size_bytes == 0
    
    def test_tags_handling(self, sample_attribution, sample_metrics):
        """Test content tags handling."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary"],
            key_insights=[],
            action_items=[],
            attribution=sample_attribution,
            processing_metrics=sample_metrics,
            tags=["market", "technology", "ai"]
        )
        
        assert content.tags == ["market", "technology", "ai"]
        assert len(content.tags) == 3
    
    def test_get_section(self, sample_attribution, sample_metrics):
        """Test section retrieval."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary point"],
            key_insights=[],
            action_items=[],
            raw_sections={
                "custom_section": "Custom content",
                "analysis": {"key": "value"}
            },
            attribution=sample_attribution,
            processing_metrics=sample_metrics
        )
        
        # Test core sections
        assert content.get_section("executive_summary") == ["Summary point"]
        assert content.get_section("key_insights") == []
        
        # Test raw sections
        assert content.get_section("custom_section") == "Custom content"
        assert content.get_section("analysis") == {"key": "value"}
        
        # Test non-existent section
        assert content.get_section("non_existent") is None
    
    def test_get_section_edge_cases(self, sample_attribution, sample_metrics):
        """Test edge cases for section retrieval."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=[],  # Empty list
            key_insights=None,  # None value
            action_items=[],
            attribution=sample_attribution,
            processing_metrics=sample_metrics,
            raw_sections={
                "empty_section": "",
                "none_section": None,
                "nested": {"deep": {"value": "found"}}
            }
        )
        
        # Empty list returns empty list
        assert content.get_section("executive_summary") == []
        
        # None returns None
        assert content.get_section("key_insights") is None
        
        # Empty string section
        assert content.get_section("empty_section") == ""
        
        # None section
        assert content.get_section("none_section") is None
        
        # Nested section
        nested = content.get_section("nested")
        assert nested == {"deep": {"value": "found"}}


class TestAttribution:
    """Test Attribution model."""
    
    def test_attribution_creation(self):
        """Test creating attribution."""
        now = datetime.now()
        attr = Attribution(
            prompt_name="market_analyzer",
            prompt_version="2.0",
            prompt_source="notion",
            analyzer_name="market",
            analyzer_version="1.5",
            model_used="gpt-4",
            processing_timestamp=now
        )
        
        assert attr.prompt_name == "market_analyzer"
        assert attr.prompt_version == "2.0"
        assert attr.prompt_source == "notion"
        assert attr.analyzer_name == "market"
        assert attr.analyzer_version == "1.5"
        assert attr.model_used == "gpt-4"
        assert attr.processing_timestamp == now
    
    def test_attribution_prompt_sources(self):
        """Test different prompt sources."""
        # Notion source
        attr = Attribution(
            prompt_name="test",
            prompt_version="1.0",
            prompt_source="notion",
            analyzer_name="test",
            analyzer_version="1.0",
            model_used="gpt-4",
            processing_timestamp=datetime.now()
        )
        assert attr.prompt_source == "notion"
        
        # YAML fallback
        attr.prompt_source = "yaml"
        assert attr.prompt_source == "yaml"
        
        # Custom source
        attr.prompt_source = "custom"
        assert attr.prompt_source == "custom"


class TestProcessingMetrics:
    """Test ProcessingMetrics model."""
    
    def test_metrics_creation(self):
        """Test creating processing metrics."""
        metrics = ProcessingMetrics(
            processing_time_seconds=5.2,
            tokens_used=1500,
            estimated_cost=0.045,
            quality_score=0.85,
            confidence_score=0.9,
            cache_hit=False
        )
        
        assert metrics.processing_time_seconds == 5.2
        assert metrics.tokens_used == 1500
        assert metrics.estimated_cost == 0.045
        assert metrics.quality_score == 0.85
        assert metrics.confidence_score == 0.9
        assert metrics.cache_hit is False
    
    def test_metrics_with_errors(self):
        """Test metrics with error tracking."""
        metrics = ProcessingMetrics(
            processing_time_seconds=10.0,
            tokens_used=2000,
            estimated_cost=0.06,
            quality_score=0.3,
            confidence_score=0.4,
            cache_hit=False,
            error_count=2
        )
        
        assert metrics.error_count == 2
        assert metrics.quality_score == 0.3  # Low due to errors
    
    def test_metrics_cache_hit(self):
        """Test metrics with cache hit."""
        metrics = ProcessingMetrics(
            processing_time_seconds=0.1,  # Fast due to cache
            tokens_used=0,  # No tokens used
            estimated_cost=0.0,  # No cost
            quality_score=0.9,
            confidence_score=0.95,
            cache_hit=True
        )
        
        assert metrics.cache_hit is True
        assert metrics.processing_time_seconds == 0.1
        assert metrics.tokens_used == 0
        assert metrics.estimated_cost == 0.0