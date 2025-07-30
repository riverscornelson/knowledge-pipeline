"""Tests for concrete content template implementations."""

import pytest
from datetime import datetime
from typing import List, Dict, Any

from src.formatting.content_templates import (
    GeneralContentTemplate,
    ResearchPaperTemplate,
    MarketNewsTemplate
)
from src.formatting.models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    Insight,
    ProcessingMetrics
)


class TestGeneralContentTemplate:
    """Test GeneralContentTemplate functionality."""
    
    @pytest.fixture
    def template(self):
        """Create template instance."""
        return GeneralContentTemplate()
    
    @pytest.fixture
    def sample_content(self):
        """Create sample enriched content."""
        return EnrichedContent(
            content_type="general",
            source_id="test123",
            source_title="General Document",
            quality_score=0.85,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Summary point 1", "Summary point 2", "Summary point 3"],
            key_insights=[
                Insight(text="Important finding", confidence=0.9, supporting_evidence="Data shows..."),
                Insight(text="Another insight", confidence=0.7, tags=["market", "trend"])
            ],
            action_items=[
                ActionItem(text="Critical task", priority=ActionPriority.CRITICAL, assignee="Team Lead"),
                ActionItem(text="High priority", priority=ActionPriority.HIGH, due_date=datetime(2024, 12, 31)),
                ActionItem(text="Medium task", priority=ActionPriority.MEDIUM),
                ActionItem(text="Low priority", priority=ActionPriority.LOW)
            ],
            attribution=Attribution(
                prompt_name="general_analyzer",
                prompt_version="1.0",
                prompt_source="notion",
                analyzer_name="general",
                analyzer_version="2.0",
                model_used="gpt-4",
                processing_timestamp=datetime(2024, 1, 15, 10, 30, 0)
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=3.5,
                tokens_used=1500,
                estimated_cost=0.045,
                quality_score=0.85,
                confidence_score=0.9,
                cache_hit=True
            ),
            raw_sections={
                "detailed_analysis": "This is a detailed analysis section",
                "custom_data": {"key1": "value1", "key2": "value2"}
            }
        )
    
    def test_template_metadata(self, template):
        """Test template name and supported types."""
        assert template.get_template_name() == "general"
        assert "general" in template.get_supported_content_types()
        assert "unknown" in template.get_supported_content_types()
        assert "other" in template.get_supported_content_types()
    
    def test_section_order(self, template):
        """Test section ordering."""
        order = template.get_section_order()
        
        # Quality indicator should be first
        assert order[0] == "quality_indicator"
        
        # Executive summary near top
        assert "executive_summary" in order[:3]
        
        # Raw content and metadata at end
        assert "raw_content" in order[-3:]
        assert "processing_metadata" in order[-3:]
    
    def test_format_executive_summary(self, template, sample_content):
        """Test executive summary formatting."""
        blocks = template.format_section("executive_summary", sample_content.executive_summary, sample_content)
        
        assert len(blocks) == 3
        for i, block in enumerate(blocks):
            assert block["type"] == "bulleted_list_item"
            assert block["bulleted_list_item"]["rich_text"][0]["text"]["content"] == f"Summary point {i+1}"
    
    def test_format_executive_summary_truncation(self, template, sample_content):
        """Test executive summary truncates to 5 points."""
        long_summary = [f"Point {i}" for i in range(10)]
        blocks = template._format_executive_summary(long_summary)
        
        assert len(blocks) == 5  # Max 5 points
    
    def test_format_insights(self, template, sample_content):
        """Test insight formatting."""
        blocks = template.format_section("key_insights", sample_content.key_insights, sample_content)
        
        # Should have numbered items plus evidence
        assert blocks[0]["type"] == "numbered_list_item"
        assert "Important finding" in blocks[0]["numbered_list_item"]["rich_text"][0]["text"]["content"]
        
        # Supporting evidence as sub-bullet
        assert blocks[1]["type"] == "bulleted_list_item"
        assert "Evidence: Data shows..." in blocks[1]["bulleted_list_item"]["rich_text"][0]["text"]["content"]
        assert blocks[1]["bulleted_list_item"]["rich_text"][0]["annotations"]["italic"] is True
        
        # Low confidence shows percentage
        assert blocks[2]["type"] == "numbered_list_item"
        assert "confidence: 70%" in blocks[2]["numbered_list_item"]["rich_text"][0]["text"]["content"]
    
    def test_format_insights_truncation(self, template, sample_content):
        """Test insights truncate to 10 items."""
        many_insights = [Insight(text=f"Insight {i}", confidence=0.9) for i in range(15)]
        blocks = template._format_insights(many_insights)
        
        # Count numbered list items only
        numbered_items = [b for b in blocks if b["type"] == "numbered_list_item"]
        assert len(numbered_items) == 10  # Max 10 insights
    
    def test_format_action_items(self, template, sample_content):
        """Test action item formatting."""
        blocks = template.format_section("action_items", sample_content.action_items, sample_content)
        
        # Should be to-do items
        assert all(block["type"] == "to_do" for block in blocks)
        
        # Check priority ordering and emojis
        assert "🔴" in blocks[0]["to_do"]["rich_text"][0]["text"]["content"]  # Critical
        assert "🟡" in blocks[1]["to_do"]["rich_text"][0]["text"]["content"]  # High
        assert "🟢" in blocks[2]["to_do"]["rich_text"][0]["text"]["content"]  # Medium
        assert "⚪" in blocks[3]["to_do"]["rich_text"][0]["text"]["content"]  # Low
        
        # Check due date formatting
        assert "Due: 2024-12-31" in blocks[1]["to_do"]["rich_text"][0]["text"]["content"]
    
    def test_format_attribution(self, template, sample_content):
        """Test attribution formatting."""
        blocks = template.format_section("attribution", sample_content.attribution, sample_content)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "paragraph"
        
        text = blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert "general_analyzer" in text
        assert "gpt-4" in text
        assert "2024-01-15 10:30:00" in text
        
        # Should be styled
        assert blocks[0]["paragraph"]["rich_text"][0]["annotations"]["italic"] is True
        assert blocks[0]["paragraph"]["rich_text"][0]["annotations"]["color"] == "gray"
    
    def test_format_processing_metadata(self, template, sample_content):
        """Test processing metadata formatting."""
        blocks = template.format_section("processing_metadata", sample_content.processing_metrics, sample_content)
        
        # Should be bullet list
        assert all(block["type"] == "bulleted_list_item" for block in blocks)
        
        # Check all metrics present
        texts = [block["bulleted_list_item"]["rich_text"][0]["text"]["content"] for block in blocks]
        assert any("3.5s" in text for text in texts)  # Processing time
        assert any("1,500" in text for text in texts)  # Tokens used
        assert any("$0.045" in text for text in texts)  # Cost
        assert any("85%" in text for text in texts)  # Quality score
        assert any("Cache hit: Yes" in text for text in texts)  # Cache hit
    
    def test_format_raw_content(self, template):
        """Test raw content formatting."""
        # With content
        content = "This is raw content"
        blocks = template._format_raw_content(content)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "code"
        assert blocks[0]["code"]["rich_text"][0]["text"]["content"] == content
        assert blocks[0]["code"]["language"] == "plain text"
    
    def test_format_raw_content_truncation(self, template):
        """Test raw content truncation."""
        long_content = "x" * 10000
        blocks = template._format_raw_content(long_content)
        
        assert len(blocks[0]["code"]["rich_text"][0]["text"]["content"]) < 6000
        assert "... (truncated)" in blocks[0]["code"]["rich_text"][0]["text"]["content"]
    
    def test_format_raw_content_empty(self, template):
        """Test empty raw content."""
        blocks = template._format_raw_content(None)
        
        assert blocks[0]["type"] == "paragraph"
        assert "Raw content not available" in blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
    
    def test_format_generic_section_list(self, template):
        """Test generic section formatting with list."""
        content = ["Item 1", "Item 2", "Item 3"]
        blocks = template._format_generic_section(content)
        
        assert len(blocks) == 3
        for i, block in enumerate(blocks):
            assert block["type"] == "paragraph"
            assert block["paragraph"]["rich_text"][0]["text"]["content"] == f"Item {i+1}"
    
    def test_format_generic_section_dict(self, template):
        """Test generic section formatting with dict."""
        content = {"key1": "value1", "key2": "value2"}
        blocks = template._format_generic_section(content)
        
        assert len(blocks) == 2
        for block in blocks:
            assert block["type"] == "paragraph"
            # Key should be bold
            assert block["paragraph"]["rich_text"][0]["annotations"]["bold"] is True
    
    def test_format_generic_section_string(self, template):
        """Test generic section formatting with string."""
        content = "Simple text content"
        blocks = template._format_generic_section(content)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "paragraph"
        assert blocks[0]["paragraph"]["rich_text"][0]["text"]["content"] == content


class TestResearchPaperTemplate:
    """Test ResearchPaperTemplate functionality."""
    
    @pytest.fixture
    def template(self):
        """Create template instance."""
        return ResearchPaperTemplate()
    
    @pytest.fixture
    def sample_content(self):
        """Create sample research paper content."""
        return EnrichedContent(
            content_type="research_paper",
            source_id="paper123",
            source_title="Impact of AI on Healthcare",
            quality_score=0.9,
            quality_level=ContentQuality.EXCELLENT,
            executive_summary=["Major finding about AI diagnosis", "Cost reduction potential"],
            key_insights=[
                Insight(text="AI improves diagnosis accuracy by 23%", confidence=0.95)
            ],
            action_items=[],
            attribution=Attribution(
                prompt_name="research_analyzer",
                prompt_version="1.0",
                prompt_source="notion",
                analyzer_name="research",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=5.0,
                tokens_used=2000,
                estimated_cost=0.06,
                quality_score=0.9,
                confidence_score=0.95
            ),
            raw_sections={
                "methodology": "Double-blind randomized control trial with 1000 participants",
                "statistical_significance": "p < 0.001",
                "citations": ["Smith et al. 2023", "Jones et al. 2022"],
                "key_findings": ["Finding 1", "Finding 2"],
                "limitations": "Sample size limited to urban hospitals"
            }
        )
    
    def test_template_metadata(self, template):
        """Test template name and supported types."""
        assert template.get_template_name() == "research_paper"
        types = template.get_supported_content_types()
        assert "research_paper" in types
        assert "academic_paper" in types
        assert "study" in types
        assert "research" in types
    
    def test_section_order(self, template):
        """Test research-specific section ordering."""
        order = template.get_section_order()
        
        # Research-specific sections
        assert "key_findings" in order
        assert "methodology" in order
        assert "statistical_significance" in order
        assert "citations" in order
        assert "limitations" in order
        
        # Key findings before methodology
        assert order.index("key_findings") < order.index("methodology")
    
    def test_format_key_findings(self, template, sample_content):
        """Test key findings formatting as callouts."""
        findings = sample_content.raw_sections["key_findings"]
        blocks = template._format_key_findings(findings)
        
        assert len(blocks) == 2
        for block in blocks:
            assert block["type"] == "callout"
            assert block["callout"]["icon"]["emoji"] == "🔬"
            assert block["callout"]["color"] == "blue_background"
    
    def test_format_methodology(self, template, sample_content):
        """Test methodology formatting."""
        methodology = sample_content.raw_sections["methodology"]
        blocks = template._format_methodology(methodology)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "callout"
        assert blocks[0]["callout"]["icon"]["emoji"] == "📊"
        assert "Methodology" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        assert blocks[0]["callout"]["rich_text"][0]["annotations"]["bold"] is True
    
    def test_format_citations(self, template, sample_content):
        """Test citation formatting as quotes."""
        citations = sample_content.raw_sections["citations"]
        blocks = template._format_citations(citations)
        
        assert len(blocks) == 2
        for i, block in enumerate(blocks):
            assert block["type"] == "quote"
            assert citations[i] in block["quote"]["rich_text"][0]["text"]["content"]
    
    def test_format_section_delegation(self, template, sample_content):
        """Test that common sections delegate to general template."""
        # These should use general template formatting
        exec_blocks = template.format_section("executive_summary", sample_content.executive_summary, sample_content)
        assert all(block["type"] == "bulleted_list_item" for block in exec_blocks)
        
        # Research-specific sections use custom formatting
        findings_blocks = template.format_section("key_findings", ["Finding"], sample_content)
        assert findings_blocks[0]["type"] == "callout"


class TestMarketNewsTemplate:
    """Test MarketNewsTemplate functionality."""
    
    @pytest.fixture
    def template(self):
        """Create template instance."""
        return MarketNewsTemplate()
    
    @pytest.fixture
    def sample_content(self):
        """Create sample market news content."""
        return EnrichedContent(
            content_type="market_news",
            source_id="news123",
            source_title="Tech Giants Q4 Earnings",
            quality_score=0.8,
            quality_level=ContentQuality.HIGH,
            executive_summary=["Revenue beat expectations", "Strong cloud growth"],
            key_insights=[],
            action_items=[
                ActionItem(text="Review portfolio allocation", priority=ActionPriority.HIGH)
            ],
            attribution=Attribution(
                prompt_name="market_analyzer",
                prompt_version="1.0",
                prompt_source="notion",
                analyzer_name="market",
                analyzer_version="1.0",
                model_used="gpt-4",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=2.5,
                tokens_used=1200,
                estimated_cost=0.036,
                quality_score=0.8,
                confidence_score=0.85
            ),
            raw_sections={
                "market_impact": "High - Major shift in tech sector valuations",
                "timeline": ["Q4 2023: Earnings announced", "Q1 2024: Market reaction"],
                "affected_parties": ["Apple", "Microsoft", "Google", "Tech ETFs"],
                "risk_assessment": "Moderate risk of sector rotation"
            }
        )
    
    def test_template_metadata(self, template):
        """Test template name and supported types."""
        assert template.get_template_name() == "market_news"
        types = template.get_supported_content_types()
        assert "market_news" in types
        assert "news" in types
        assert "market_update" in types
        assert "business_news" in types
    
    def test_section_order(self, template):
        """Test market news section ordering."""
        order = template.get_section_order()
        
        # Market impact should be first after quality indicator
        assert order[1] == "market_impact"
        
        # Market-specific sections present
        assert "timeline" in order
        assert "affected_parties" in order
        assert "competitive_implications" in order
        assert "risk_assessment" in order
    
    def test_format_market_impact_high(self, template, sample_content):
        """Test high market impact formatting."""
        impact = sample_content.raw_sections["market_impact"]
        blocks = template._format_market_impact(impact)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "callout"
        assert blocks[0]["callout"]["color"] == "red_background"  # High impact
        assert blocks[0]["callout"]["icon"]["emoji"] == "📈"
        assert "Market Impact:" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
    
    def test_format_market_impact_levels(self, template, sample_content):
        """Test different market impact levels."""
        # Moderate impact
        blocks = template._format_market_impact("Moderate impact on sector")
        assert blocks[0]["callout"]["color"] == "yellow_background"
        assert blocks[0]["callout"]["icon"]["emoji"] == "📊"
        
        # Low impact
        blocks = template._format_market_impact("Low impact expected")
        assert blocks[0]["callout"]["color"] == "green_background"
        assert blocks[0]["callout"]["icon"]["emoji"] == "📉"
    
    def test_format_timeline_list(self, template, sample_content):
        """Test timeline formatting as list."""
        timeline = sample_content.raw_sections["timeline"]
        blocks = template._format_timeline(timeline)
        
        assert len(blocks) == 2
        for i, block in enumerate(blocks):
            assert block["type"] == "bulleted_list_item"
            assert "📅" in block["bulleted_list_item"]["rich_text"][0]["text"]["content"]
            assert timeline[i] in block["bulleted_list_item"]["rich_text"][0]["text"]["content"]
    
    def test_format_timeline_string(self, template):
        """Test timeline formatting as string."""
        timeline = "Expected to unfold over Q1 2024"
        blocks = template._format_timeline(timeline)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "paragraph"
        assert "📅 Timeline:" in blocks[0]["paragraph"]["rich_text"][0]["text"]["content"]
        assert blocks[0]["paragraph"]["rich_text"][0]["annotations"]["bold"] is True
    
    def test_format_affected_parties(self, template, sample_content):
        """Test affected parties formatting as tags."""
        parties = sample_content.raw_sections["affected_parties"]
        blocks = template._format_affected_parties(parties)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "paragraph"
        
        # Check formatting
        rich_text = blocks[0]["paragraph"]["rich_text"]
        assert rich_text[0]["text"]["content"] == "Affected: "
        assert rich_text[0]["annotations"]["bold"] is True
        assert rich_text[1]["annotations"]["color"] == "blue"
        
        # Check all parties listed
        parties_text = rich_text[1]["text"]["content"]
        for party in parties:
            assert party in parties_text
    
    def test_format_risk_assessment(self, template, sample_content):
        """Test risk assessment formatting."""
        risks = sample_content.raw_sections["risk_assessment"]
        blocks = template._format_risk_assessment(risks)
        
        assert len(blocks) == 1
        assert blocks[0]["type"] == "callout"
        assert blocks[0]["callout"]["icon"]["emoji"] == "⚠️"
        assert blocks[0]["callout"]["color"] == "yellow_background"
        assert risks in blocks[0]["callout"]["rich_text"][0]["text"]["content"]