"""Shared fixtures for formatting tests."""

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


@pytest.fixture
def standard_attribution():
    """Create standard attribution for tests."""
    return Attribution(
        prompt_name="test_analyzer",
        prompt_version="1.0",
        prompt_source="notion",
        analyzer_name="test",
        analyzer_version="1.0",
        model_used="gpt-4",
        processing_timestamp=datetime(2024, 1, 15, 10, 30, 0)
    )


@pytest.fixture
def standard_metrics():
    """Create standard processing metrics for tests."""
    return ProcessingMetrics(
        processing_time_seconds=3.5,
        tokens_used=1500,
        estimated_cost=0.045,
        quality_score=0.85,
        confidence_score=0.9,
        cache_hit=False
    )


@pytest.fixture
def high_quality_content(standard_attribution, standard_metrics):
    """Create high quality content sample."""
    return EnrichedContent(
        content_type="general",
        source_id="doc123",
        source_title="High Quality Analysis",
        quality_score=0.92,
        quality_level=ContentQuality.EXCELLENT,
        executive_summary=[
            "Key finding about market dynamics",
            "Important trend identified",
            "Strategic opportunity discovered"
        ],
        key_insights=[
            Insight(
                text="Market is shifting towards sustainable solutions",
                confidence=0.95,
                supporting_evidence="Based on analysis of 50 companies",
                tags=["sustainability", "market-trend"]
            ),
            Insight(
                text="Competition intensifying in key segments",
                confidence=0.85,
                tags=["competition", "risk"]
            )
        ],
        action_items=[
            ActionItem(
                text="Immediately review portfolio allocation",
                priority=ActionPriority.CRITICAL,
                context="Market shift requires urgent response"
            ),
            ActionItem(
                text="Schedule strategy session for Q2",
                priority=ActionPriority.HIGH,
                due_date=datetime(2024, 4, 1)
            )
        ],
        attribution=standard_attribution,
        processing_metrics=standard_metrics,
        tags=["market", "strategy", "urgent"],
        raw_sections={
            "detailed_analysis": "Comprehensive market analysis...",
            "risk_assessment": "Key risks identified...",
            "recommendations": ["Rec 1", "Rec 2", "Rec 3"]
        }
    )


@pytest.fixture
def low_quality_content(standard_attribution, standard_metrics):
    """Create low quality content sample."""
    metrics = ProcessingMetrics(
        processing_time_seconds=1.0,
        tokens_used=500,
        estimated_cost=0.015,
        quality_score=0.35,
        confidence_score=0.4,
        cache_hit=False,
        error_count=2
    )
    
    return EnrichedContent(
        content_type="general",
        source_id="doc456",
        source_title="Partial Analysis",
        quality_score=0.35,
        quality_level=ContentQuality.LOW,
        executive_summary=["Unable to extract complete insights"],
        key_insights=[],
        action_items=[],
        attribution=standard_attribution,
        processing_metrics=metrics,
        tags=["incomplete", "error"]
    )


@pytest.fixture
def market_news_content(standard_attribution, standard_metrics):
    """Create market news content sample."""
    return EnrichedContent(
        content_type="market_news",
        source_id="news789",
        source_title="Tech Earnings Exceed Expectations",
        quality_score=0.88,
        quality_level=ContentQuality.HIGH,
        executive_summary=[
            "Apple reports record Q4 revenue",
            "Services segment drives growth",
            "China market showing recovery"
        ],
        key_insights=[
            Insight(
                text="Tech sector outperforming broader market",
                confidence=0.9,
                supporting_evidence="All major tech companies beat estimates"
            )
        ],
        action_items=[
            ActionItem(
                text="Review tech sector allocation",
                priority=ActionPriority.HIGH
            )
        ],
        attribution=standard_attribution,
        processing_metrics=standard_metrics,
        tags=["earnings", "technology", "market-news"],
        raw_sections={
            "market_impact": "High - Expected to drive indices higher",
            "affected_parties": ["AAPL", "MSFT", "GOOGL", "Tech ETFs"],
            "timeline": [
                "Oct 26: Earnings announced",
                "Oct 27: Market reaction",
                "Oct 30: Analyst updates"
            ],
            "risk_assessment": "Low - Strong fundamentals support valuation"
        }
    )


@pytest.fixture
def research_paper_content(standard_attribution, standard_metrics):
    """Create research paper content sample."""
    return EnrichedContent(
        content_type="research_paper",
        source_id="paper001",
        source_title="AI Impact on Healthcare Outcomes",
        quality_score=0.95,
        quality_level=ContentQuality.EXCELLENT,
        executive_summary=[
            "AI improves diagnostic accuracy by 23%",
            "Cost reduction of 15% in pilot programs",
            "Patient satisfaction increased"
        ],
        key_insights=[
            Insight(
                text="Machine learning models outperform traditional methods",
                confidence=0.98,
                supporting_evidence="p < 0.001 across all metrics",
                tags=["ai", "healthcare", "research"]
            )
        ],
        action_items=[],
        attribution=standard_attribution,
        processing_metrics=standard_metrics,
        tags=["research", "ai", "healthcare"],
        raw_sections={
            "methodology": "Randomized controlled trial with 5000 participants",
            "key_findings": [
                "AI reduces false negatives by 40%",
                "Time to diagnosis decreased by 60%"
            ],
            "statistical_significance": "p < 0.001 for primary endpoints",
            "limitations": "Study limited to urban hospitals",
            "citations": [
                "Smith et al., Nature Medicine, 2024",
                "Johnson et al., JAMA, 2023"
            ]
        }
    )


@pytest.fixture
def varied_format_data():
    """Create enrichment data with varied formats for testing normalization."""
    return {
        "content_analysis": {
            # String instead of list
            "executive_summary": "Single string summary that should be converted to list",
            
            # Mixed format insights
            "key_insights": [
                "Simple string insight",
                {
                    "text": "Complex insight with metadata",
                    "confidence": 0.85,
                    "evidence": "Supporting data"
                },
                {"text": "Minimal dict insight"}
            ],
            
            # String with priority markers
            "action_items": "URGENT: Do this first\nHigh: Then this\nMedium priority task",
            
            # Alternative section names
            "summary": "Alternative summary name",
            "insights": ["Alt insight 1", "Alt insight 2"],
            "next_steps": ["Alt action 1", "Alt action 2"],
            
            # Custom sections
            "market_matrix": [
                ["Q1", "Q2", "Q3", "Q4"],
                [100, 120, 110, 140]
            ],
            "custom_analysis": {
                "bull_case": "Positive outlook",
                "bear_case": "Potential risks",
                "neutral_case": "Balanced view"
            }
        },
        "metadata": {
            "quality_score": 0.75,
            "content_type": "market_analysis",
            "processing_time": 2.5,
            "analyzer": "market_analyzer_v2"
        }
    }


@pytest.fixture
def error_content_data():
    """Create data that should trigger error handling."""
    return [
        # Not a dict
        "invalid string data",
        
        # Missing content_analysis
        {"metadata": {"quality_score": 0.5}},
        
        # content_analysis not a dict
        {
            "content_analysis": ["should", "be", "dict"],
            "metadata": {"quality_score": 0.5}
        },
        
        # Deeply nested None
        {
            "content_analysis": {
                "section": {
                    "subsection": {
                        "data": None
                    }
                }
            },
            "metadata": {}
        },
        
        # All None values
        {
            "content_analysis": {
                "executive_summary": None,
                "key_insights": None,
                "action_items": None
            },
            "metadata": None
        }
    ]


@pytest.fixture
def platform_test_content(high_quality_content):
    """Create content suitable for platform-specific testing."""
    # Add some table-like data
    high_quality_content.raw_sections["comparison_table"] = [
        {"feature": "Speed", "old": "Slow", "new": "Fast"},
        {"feature": "Cost", "old": "High", "new": "Low"},
        {"feature": "Quality", "old": "Medium", "new": "High"}
    ]
    
    # Add long text for wrapping tests
    high_quality_content.raw_sections["long_description"] = (
        "This is a very long description that would need to be wrapped on mobile devices "
        "to ensure proper display. It contains multiple sentences and technical details "
        "that should be formatted appropriately for the target platform. "
        "The adaptive formatter should handle this gracefully."
    )
    
    return high_quality_content