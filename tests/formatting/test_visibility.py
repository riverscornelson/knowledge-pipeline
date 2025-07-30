"""Tests for visibility rules engine."""

import pytest
from datetime import datetime

from src.formatting.visibility import VisibilityRules
from src.formatting.models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    ProcessingMetrics
)


class TestVisibilityRules:
    """Test VisibilityRules functionality."""
    
    @pytest.fixture
    def sample_content_high_quality(self):
        """Create high quality content."""
        return EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.85,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary"],
            key_insights=[],
            action_items=[],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="yaml",
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
    
    @pytest.fixture
    def sample_content_low_quality(self):
        """Create low quality content."""
        content = self.sample_content_high_quality()
        content.quality_score = 0.4
        content.quality_level = ContentQuality.LOW
        return content
    
    @pytest.fixture
    def sample_content_with_critical_actions(self):
        """Create content with critical actions."""
        content = self.sample_content_high_quality()
        content.action_items = [
            ActionItem(text="Critical action", priority=ActionPriority.CRITICAL),
            ActionItem(text="Medium action", priority=ActionPriority.MEDIUM)
        ]
        return content
    
    def test_always_visible_sections(self, sample_content_high_quality):
        """Test sections that are always visible."""
        content = sample_content_high_quality
        
        assert VisibilityRules.should_show_section("quality_indicator", content) is True
        assert VisibilityRules.should_show_section("executive_summary", content) is True
    
    def test_quality_based_visibility(
        self,
        sample_content_high_quality,
        sample_content_low_quality
    ):
        """Test visibility based on quality scores."""
        high_quality = sample_content_high_quality
        low_quality = sample_content_low_quality
        
        # High quality shows more sections
        assert VisibilityRules.should_show_section("detailed_analysis", high_quality) is True
        assert VisibilityRules.should_show_section("strategic_implications", high_quality) is True
        
        # Low quality hides these sections
        assert VisibilityRules.should_show_section("detailed_analysis", low_quality) is False
        assert VisibilityRules.should_show_section("strategic_implications", low_quality) is False
        
        # Some sections always hidden
        assert VisibilityRules.should_show_section("raw_content", high_quality) is False
        assert VisibilityRules.should_show_section("processing_metadata", high_quality) is False
    
    def test_action_items_visibility(
        self,
        sample_content_high_quality,
        sample_content_with_critical_actions
    ):
        """Test action items visibility based on priority."""
        # No high priority actions - not visible
        content_no_actions = sample_content_high_quality
        assert VisibilityRules.should_show_section("action_items", content_no_actions) is False
        
        # With critical actions - visible
        content_critical = sample_content_with_critical_actions
        assert VisibilityRules.should_show_section("action_items", content_critical) is True
        
        # With high priority actions - visible
        content_high = sample_content_high_quality
        content_high.action_items = [
            ActionItem(text="High action", priority=ActionPriority.HIGH)
        ]
        assert VisibilityRules.should_show_section("action_items", content_high) is True
    
    def test_urgency_overrides(self, sample_content_with_critical_actions):
        """Test urgency overrides for critical content."""
        content = sample_content_with_critical_actions
        content.quality_score = 0.5  # Low quality but critical actions
        
        # Critical actions override quality thresholds
        assert VisibilityRules.should_show_section("risk_assessment", content) is True
        assert VisibilityRules.should_show_section("strategic_implications", content) is True
    
    def test_content_type_rules(self, sample_content_high_quality):
        """Test content type specific visibility rules."""
        # Research paper rules
        research_content = sample_content_high_quality
        research_content.content_type = "research_paper"
        
        assert VisibilityRules.should_show_section("methodology", research_content) is True
        assert VisibilityRules.should_show_section("market_impact", research_content) is False
        
        # Market news rules
        news_content = sample_content_high_quality
        news_content.content_type = "market_news"
        
        assert VisibilityRules.should_show_section("market_impact", news_content) is True
        assert VisibilityRules.should_show_section("methodology", news_content) is False
    
    def test_force_minimal_mode(self, sample_content_high_quality):
        """Test force minimal mode."""
        content = sample_content_high_quality
        
        # Normal mode shows many sections
        assert VisibilityRules.should_show_section("key_insights", content, force_minimal=False) is True
        
        # Minimal mode only shows essentials
        assert VisibilityRules.should_show_section("key_insights", content, force_minimal=True) is False
        assert VisibilityRules.should_show_section("quality_indicator", content, force_minimal=True) is True
        assert VisibilityRules.should_show_section("executive_summary", content, force_minimal=True) is True
    
    def test_get_visible_sections(self, sample_content_high_quality):
        """Test getting all visible sections."""
        content = sample_content_high_quality
        available_sections = [
            "quality_indicator",
            "executive_summary",
            "key_insights",
            "action_items",
            "detailed_analysis",
            "raw_content",
            "processing_metadata"
        ]
        
        visible = VisibilityRules.get_visible_sections(content, available_sections)
        
        assert "quality_indicator" in visible
        assert "executive_summary" in visible
        assert "key_insights" in visible
        assert "detailed_analysis" in visible
        assert "raw_content" not in visible
        assert "processing_metadata" not in visible
    
    def test_get_toggle_sections(self, sample_content_high_quality):
        """Test getting sections for toggles."""
        content = sample_content_high_quality
        available_sections = [
            "quality_indicator",
            "executive_summary",
            "raw_content",
            "processing_metadata"
        ]
        
        toggle_sections = VisibilityRules.get_toggle_sections(content, available_sections)
        
        assert "raw_content" in toggle_sections
        assert "processing_metadata" in toggle_sections
        assert "quality_indicator" not in toggle_sections
        assert "executive_summary" not in toggle_sections
    
    def test_section_priority(self):
        """Test section display priority."""
        # Higher priority (lower number) sections
        assert VisibilityRules.get_section_priority("quality_indicator") < \
               VisibilityRules.get_section_priority("raw_content")
        
        assert VisibilityRules.get_section_priority("executive_summary") < \
               VisibilityRules.get_section_priority("technical_details")
        
        assert VisibilityRules.get_section_priority("action_items") < \
               VisibilityRules.get_section_priority("processing_metadata")
        
        # Unknown section gets middle priority
        unknown_priority = VisibilityRules.get_section_priority("unknown_section")
        assert unknown_priority > 0
    
    def test_should_use_callout(
        self,
        sample_content_high_quality,
        sample_content_with_critical_actions
    ):
        """Test callout formatting decisions."""
        # Quality indicator always uses callout
        assert VisibilityRules.should_use_callout(
            "quality_indicator",
            sample_content_high_quality
        ) is True
        
        # Action items use callout only with high priority
        assert VisibilityRules.should_use_callout(
            "action_items",
            sample_content_high_quality
        ) is False
        
        assert VisibilityRules.should_use_callout(
            "action_items",
            sample_content_with_critical_actions
        ) is True
        
        # High quality content can use more callouts
        high_quality = sample_content_high_quality
        high_quality.quality_level = ContentQuality.EXCELLENT
        
        assert VisibilityRules.should_use_callout(
            "key_insights",
            high_quality
        ) is True
    
    def test_edge_case_quality_scores(self, sample_content_high_quality):
        """Test visibility with edge case quality scores."""
        content = sample_content_high_quality
        
        # Exactly at threshold (0.7)
        content.quality_score = 0.7
        assert VisibilityRules.should_show_section("detailed_analysis", content) is True
        
        # Just below threshold
        content.quality_score = 0.699
        assert VisibilityRules.should_show_section("detailed_analysis", content) is False
        
        # Negative quality score (error case)
        content.quality_score = -0.5
        assert VisibilityRules.should_show_section("detailed_analysis", content) is False
        assert VisibilityRules.should_show_section("executive_summary", content) is True  # Always visible
        
        # Quality score > 1.0
        content.quality_score = 1.5
        assert VisibilityRules.should_show_section("detailed_analysis", content) is True
    
    def test_multiple_urgency_factors(self):
        """Test multiple urgency factors combined."""
        content = EnrichedContent(
            content_type="general",
            source_id="test",
            source_title="Test",
            quality_score=0.3,  # Very low quality
            quality_level=ContentQuality.LOW,
            executive_summary=["Critical situation"],
            key_insights=[],
            action_items=[
                ActionItem(text="Critical 1", priority=ActionPriority.CRITICAL),
                ActionItem(text="Critical 2", priority=ActionPriority.CRITICAL),
                ActionItem(text="High 1", priority=ActionPriority.HIGH)
            ],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="yaml",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.3,
                confidence_score=0.4
            )
        )
        
        # Multiple critical actions should strongly override quality
        assert VisibilityRules.should_show_section("action_items", content) is True
        assert VisibilityRules.should_show_section("risk_assessment", content) is True
        assert VisibilityRules.should_show_section("strategic_implications", content) is True
        assert VisibilityRules.should_use_callout("action_items", content) is True
    
    def test_custom_section_visibility(self, sample_content_high_quality):
        """Test visibility for custom/unknown sections."""
        content = sample_content_high_quality
        
        # Unknown sections use default threshold
        assert VisibilityRules.should_show_section("custom_analysis", content) is True  # High quality
        
        content.quality_score = 0.4
        assert VisibilityRules.should_show_section("custom_analysis", content) is False  # Low quality
        
        # Special custom sections that might have rules
        assert VisibilityRules.should_show_section("error_details", content) is False
        assert VisibilityRules.should_show_section("debug_info", content) is False
    
    def test_content_type_specific_overrides(self):
        """Test content type specific visibility overrides."""
        # Create market news with medium quality
        market_content = EnrichedContent(
            content_type="market_news",
            source_id="test",
            source_title="Test",
            quality_score=0.6,  # Medium quality
            quality_level=ContentQuality.MEDIUM,
            executive_summary=["Market update"],
            key_insights=[],
            action_items=[],
            attribution=Attribution(
                prompt_name="test",
                prompt_version="1.0",
                prompt_source="yaml",
                analyzer_name="test",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=1.0,
                tokens_used=100,
                estimated_cost=0.01,
                quality_score=0.6,
                confidence_score=0.7
            )
        )
        
        # Market impact should be visible for market news even at medium quality
        assert VisibilityRules.should_show_section("market_impact", market_content) is True
        
        # But methodology should be hidden (research-specific)
        assert VisibilityRules.should_show_section("methodology", market_content) is False
    
    def test_get_visible_sections_with_duplicates(self, sample_content_high_quality):
        """Test handling of duplicate sections in available list."""
        content = sample_content_high_quality
        available_sections = [
            "executive_summary",
            "executive_summary",  # Duplicate
            "key_insights",
            "action_items",
            "key_insights",  # Duplicate
            "raw_content"
        ]
        
        visible = VisibilityRules.get_visible_sections(content, available_sections)
        
        # Should handle duplicates gracefully
        assert visible.count("executive_summary") == 1
        assert visible.count("key_insights") == 1
    
    def test_section_priority_ordering(self):
        """Test section priority ordering for display."""
        sections = [
            "processing_metadata",
            "executive_summary",
            "raw_content",
            "quality_indicator",
            "action_items",
            "key_insights"
        ]
        
        # Sort by priority
        sorted_sections = sorted(sections, key=VisibilityRules.get_section_priority)
        
        # Quality indicator should be first
        assert sorted_sections[0] == "quality_indicator"
        
        # Executive summary should be near top
        assert sorted_sections.index("executive_summary") < 3
        
        # Processing metadata should be near bottom
        assert sorted_sections.index("processing_metadata") > len(sorted_sections) - 3
    
    def test_callout_decision_edge_cases(self, sample_content_high_quality):
        """Test edge cases for callout formatting decisions."""
        content = sample_content_high_quality
        
        # Empty action items - no callout
        content.action_items = []
        assert VisibilityRules.should_use_callout("action_items", content) is False
        
        # Only low priority actions - no callout
        content.action_items = [
            ActionItem(text="Low 1", priority=ActionPriority.LOW),
            ActionItem(text="Low 2", priority=ActionPriority.LOW)
        ]
        assert VisibilityRules.should_use_callout("action_items", content) is False
        
        # Mixed priorities with at least one high - callout
        content.action_items.append(
            ActionItem(text="High", priority=ActionPriority.HIGH)
        )
        assert VisibilityRules.should_use_callout("action_items", content) is True
    
    def test_force_minimal_comprehensive(self, sample_content_high_quality):
        """Test force minimal mode comprehensively."""
        content = sample_content_high_quality
        all_sections = [
            "quality_indicator",
            "executive_summary",
            "key_insights",
            "action_items",
            "detailed_analysis",
            "strategic_implications",
            "market_impact",
            "risk_assessment",
            "raw_content",
            "processing_metadata"
        ]
        
        # Normal mode
        normal_visible = [s for s in all_sections if VisibilityRules.should_show_section(s, content, force_minimal=False)]
        
        # Minimal mode
        minimal_visible = [s for s in all_sections if VisibilityRules.should_show_section(s, content, force_minimal=True)]
        
        # Minimal should have fewer sections
        assert len(minimal_visible) < len(normal_visible)
        
        # But essentials remain
        assert "quality_indicator" in minimal_visible
        assert "executive_summary" in minimal_visible
        
        # Non-essentials hidden
        assert "detailed_analysis" not in minimal_visible
        assert "strategic_implications" not in minimal_visible