"""Integration tests for the formatting pipeline."""

import pytest
from datetime import datetime
from typing import Dict, Any

from src.formatting import (
    ContentNormalizer,
    TemplateRegistry,
    AdaptiveBlockBuilder,
    VisibilityRules
)
from src.formatting.builder import Platform
from src.formatting.content_templates import (
    GeneralContentTemplate,
    ResearchPaperTemplate,
    MarketNewsTemplate
)


class TestFormattingPipeline:
    """Test the complete formatting pipeline integration."""
    
    @pytest.fixture(autouse=True)
    def setup_templates(self):
        """Ensure templates are registered."""
        # Clear and re-register to ensure clean state
        TemplateRegistry._templates = {}
        TemplateRegistry._content_type_map = {}
        
        TemplateRegistry.register(GeneralContentTemplate())
        TemplateRegistry.register(ResearchPaperTemplate())
        TemplateRegistry.register(MarketNewsTemplate())
    
    @pytest.fixture
    def market_news_enrichment(self):
        """Create a realistic market news enrichment result."""
        return {
            "content_analysis": {
                "executive_summary": [
                    "Apple announces record Q4 earnings beating analyst expectations",
                    "Services revenue grows 16% year-over-year to $22.3B",
                    "iPhone sales remain strong despite global economic headwinds"
                ],
                "market_impact": "HIGH - Likely to drive tech sector rally and impact major indices",
                "key_insights": [
                    {
                        "text": "Services segment becoming dominant revenue driver",
                        "confidence": 0.95,
                        "evidence": "Services now account for 25% of total revenue"
                    },
                    {
                        "text": "China market showing signs of recovery",
                        "confidence": 0.8,
                        "tags": ["china", "growth", "market-expansion"]
                    }
                ],
                "action_items": [
                    {
                        "text": "Review tech sector allocation immediately",
                        "priority": "critical",
                        "context": "Major earnings beat could trigger sector rotation"
                    },
                    "High priority: Analyze competitor responses",
                    "Update Q1 2024 projections based on guidance"
                ],
                "affected_parties": ["AAPL", "Tech ETFs", "Nasdaq Index", "Supply chain partners"],
                "timeline": [
                    "Oct 26: Earnings announced after market close",
                    "Oct 27: Pre-market surge expected",
                    "Oct 30: Analyst upgrades likely"
                ],
                "risk_assessment": "Moderate risk of profit-taking after initial surge. Watch for Fed commentary on tech valuations.",
                "competitive_implications": "Puts pressure on Google and Microsoft to deliver strong cloud/services growth"
            },
            "metadata": {
                "content_type": "market_news",
                "quality_score": 0.92,
                "timestamp": "2024-01-15T16:30:00Z",
                "analyzer": "market_analyzer_v3",
                "model": "gpt-4",
                "processing_time": 4.2,
                "tokens_used": 2100,
                "cost": 0.063,
                "prompt_info": {
                    "name": "market_impact_analyzer",
                    "version": "3.1",
                    "source": "notion"
                }
            }
        }
    
    @pytest.fixture
    def research_paper_enrichment(self):
        """Create a realistic research paper enrichment result."""
        return {
            "content_analysis": {
                "executive_summary": "New CRISPR variant shows 10x improvement in precision",
                "key_findings": [
                    "Novel Cas9 variant reduces off-target effects by 95%",
                    "Successfully tested in human cell lines",
                    "Potential applications in hereditary disease treatment"
                ],
                "insights": [  # Alternative name for key_insights
                    "Breakthrough could accelerate clinical trials",
                    "Patent implications for biotech sector"
                ],
                "methodology": "Dual-guide RNA system with enhanced PAM recognition. Tested across 50 genomic loci in HEK293 cells.",
                "statistical_significance": "p < 0.0001 for all primary endpoints",
                "limitations": "Long-term effects unknown. Limited to in-vitro studies.",
                "citations": [
                    "Zhang et al., Nature Biotechnology, 2024",
                    "Previous work: Liu et al., Cell, 2023"
                ],
                "practical_applications": "Immediate applications in research settings. Clinical trials possible within 2 years."
            },
            "metadata": {
                "content_type": "research_paper",
                "quality_score": 0.88,
                "confidence_score": 0.91
            }
        }
    
    @pytest.fixture
    def varied_format_enrichment(self):
        """Create enrichment with varied/non-standard formatting."""
        return {
            "content_analysis": {
                # String instead of list
                "summary": "Important finding about market trends that spans multiple areas of interest",
                # Mixed format insights
                "findings": [
                    "String insight about growth",
                    {"text": "Dict insight about risks", "confidence": 0.7},
                    "Another string insight"
                ],
                # String with line breaks for actions
                "next_steps": "URGENT: Review portfolio\nHigh: Update models\nMedium: Schedule team meeting",
                # Custom sections
                "market_analysis": {
                    "bull_case": "Strong growth potential",
                    "bear_case": "Regulatory risks",
                    "probability": 0.65
                },
                "data_tables": [
                    {"metric": "Revenue", "value": "$1.2B", "change": "+15%"},
                    {"metric": "Margin", "value": "42%", "change": "+2%"}
                ]
            },
            "metadata": {
                "quality_score": 0.75
            }
        }
    
    @pytest.fixture
    def low_quality_enrichment(self):
        """Create low quality enrichment result."""
        return {
            "content_analysis": {
                "summary": "Unable to extract meaningful insights",
                "error_notes": "Content was too fragmented"
            },
            "metadata": {
                "quality_score": 0.3,
                "error_count": 3
            }
        }
    
    @pytest.fixture
    def source_metadata(self):
        """Create standard source metadata."""
        return {
            "id": "doc_12345",
            "title": "Important Market Analysis Document",
            "url": "https://example.com/doc/12345",
            "created_at": "2024-01-15T10:00:00Z",
            "tags": ["market", "technology", "earnings"],
            "raw_content": "This is the original document content..."
        }
    
    def test_full_pipeline_market_news(self, market_news_enrichment, source_metadata):
        """Test complete pipeline for market news content."""
        # Step 1: Normalize
        content = ContentNormalizer.normalize(market_news_enrichment, source_metadata)
        
        # Verify normalization
        assert content.content_type == "market_news"
        assert content.quality_score == 0.92
        assert len(content.executive_summary) == 3
        assert len(content.key_insights) == 2
        assert len(content.action_items) == 3
        assert content.action_items[0].priority.value == "critical"
        
        # Verify custom sections preserved
        assert "affected_parties" in content.raw_sections
        assert "timeline" in content.raw_sections
        assert "risk_assessment" in content.raw_sections
        
        # Step 2: Get template
        template = TemplateRegistry.get_template(content.content_type)
        assert template is not None
        assert template.get_template_name() == "market_news"
        
        # Step 3: Build blocks
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        # Verify output structure
        assert blocks[0]["type"] == "callout"  # Quality indicator
        assert "92%" in blocks[0]["callout"]["rich_text"][0]["text"]["content"]
        
        # Market impact should be prominent (callout)
        market_impact_blocks = [b for b in blocks if b.get("type") == "callout" and 
                               any("Market Impact" in str(rich_text) for rich_text in b.get("callout", {}).get("rich_text", []))]
        assert len(market_impact_blocks) > 0
        
        # Critical actions should be visible
        todo_blocks = [b for b in blocks if b.get("type") == "to_do"]
        assert len(todo_blocks) > 0
        assert any("🔴" in b["to_do"]["rich_text"][0]["text"]["content"] for b in todo_blocks)
        
        # Custom sections should be present
        block_text = str(blocks)
        assert "AAPL" in block_text  # Affected parties
        assert "Oct 26" in block_text  # Timeline
    
    def test_full_pipeline_research_paper(self, research_paper_enrichment, source_metadata):
        """Test complete pipeline for research paper content."""
        # Update source metadata
        source_metadata["title"] = "CRISPR Precision Enhancement Study"
        
        # Step 1: Normalize
        content = ContentNormalizer.normalize(research_paper_enrichment, source_metadata)
        
        assert content.content_type == "research_paper"
        assert len(content.key_insights) == 2  # "insights" mapped to key_insights
        
        # Step 2: Get template
        template = TemplateRegistry.get_template(content.content_type)
        assert template.get_template_name() == "research_paper"
        
        # Step 3: Build blocks
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        # Research-specific formatting
        # Key findings should be in callouts
        finding_callouts = [b for b in blocks if b.get("type") == "callout" and 
                           b.get("callout", {}).get("icon", {}).get("emoji") == "🔬"]
        assert len(finding_callouts) > 0
        
        # Methodology should be present
        block_text = str(blocks)
        assert "Dual-guide RNA" in block_text
        assert "p < 0.0001" in block_text
    
    def test_full_pipeline_varied_formats(self, varied_format_enrichment, source_metadata):
        """Test pipeline handles varied input formats gracefully."""
        # Step 1: Normalize
        content = ContentNormalizer.normalize(varied_format_enrichment, source_metadata)
        
        # String summary converted to list
        assert isinstance(content.executive_summary, list)
        assert len(content.executive_summary) >= 1
        
        # Mixed insights normalized
        assert len(content.key_insights) == 3
        assert content.key_insights[1].confidence == 0.7
        
        # String actions parsed
        assert len(content.action_items) == 3
        assert content.action_items[0].priority.value == "critical"  # URGENT -> critical
        
        # Custom sections preserved
        assert "market_analysis" in content.raw_sections
        assert "data_tables" in content.raw_sections
        
        # Step 2-3: Template and build
        template = TemplateRegistry.get_template("general")  # Falls back to general
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        # Verify custom sections handled
        block_text = str(blocks)
        assert "bull_case" in block_text or "Bull Case" in block_text
    
    def test_full_pipeline_low_quality(self, low_quality_enrichment, source_metadata):
        """Test pipeline handles low quality content appropriately."""
        # Step 1: Normalize
        content = ContentNormalizer.normalize(low_quality_enrichment, source_metadata)
        
        assert content.quality_score == 0.3
        assert content.quality_level.value == "low"
        
        # Step 2-3: Template and build
        template = TemplateRegistry.get_template("general")
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        # Low quality should hide most sections in toggles
        visible_headers = [b for b in blocks if b.get("type", "").startswith("heading")]
        toggle_blocks = [b for b in blocks if b.get("type") == "toggle"]
        
        # More content in toggles than visible
        assert len(toggle_blocks) >= len(visible_headers)
    
    def test_full_pipeline_mobile_optimization(self, market_news_enrichment, source_metadata):
        """Test mobile platform optimization."""
        # Normalize
        content = ContentNormalizer.normalize(market_news_enrichment, source_metadata)
        
        # Get template
        template = TemplateRegistry.get_template(content.content_type)
        
        # Build for mobile
        mobile_builder = AdaptiveBlockBuilder(Platform.MOBILE)
        mobile_blocks = mobile_builder.build_blocks(content, template)
        
        # Build for desktop comparison
        desktop_builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        desktop_blocks = desktop_builder.build_blocks(content, template)
        
        # Mobile should use compact callouts
        mobile_callouts = [b for b in mobile_blocks if b.get("type") == "callout"]
        desktop_callouts = [b for b in desktop_blocks if b.get("type") == "callout"]
        
        # Both should have callouts but mobile uses compact style
        assert len(mobile_callouts) > 0
        assert len(desktop_callouts) > 0
    
    def test_full_pipeline_force_minimal(self, market_news_enrichment, source_metadata):
        """Test force minimal mode across pipeline."""
        # Normalize
        content = ContentNormalizer.normalize(market_news_enrichment, source_metadata)
        
        # Get template and build
        template = TemplateRegistry.get_template(content.content_type)
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        
        # Normal mode
        normal_blocks = builder.build_blocks(content, template, force_minimal=False)
        
        # Minimal mode
        minimal_blocks = builder.build_blocks(content, template, force_minimal=True)
        
        # Minimal should have fewer blocks
        assert len(minimal_blocks) < len(normal_blocks)
        
        # But still have essentials
        minimal_text = str(minimal_blocks)
        assert "Quality Score" in minimal_text
        assert "executive_summary" in minimal_text.lower() or "Executive Summary" in minimal_text
    
    def test_visibility_rules_integration(self, market_news_enrichment, source_metadata):
        """Test visibility rules work correctly in pipeline."""
        # Create high quality content
        market_news_enrichment["metadata"]["quality_score"] = 0.95
        content = ContentNormalizer.normalize(market_news_enrichment, source_metadata)
        
        # Check visibility decisions
        assert VisibilityRules.should_show_section("executive_summary", content) is True
        assert VisibilityRules.should_show_section("market_impact", content) is True
        assert VisibilityRules.should_show_section("detailed_analysis", content) is True
        assert VisibilityRules.should_show_section("raw_content", content) is False
        
        # Critical actions override
        assert VisibilityRules.should_show_section("action_items", content) is True
        assert VisibilityRules.should_use_callout("action_items", content) is True
    
    def test_error_handling_pipeline(self):
        """Test pipeline handles errors gracefully."""
        # Invalid enrichment
        invalid_enrichment = "not a dict"
        source_metadata = {"id": "test", "title": "Test"}
        
        # Should create error content
        content = ContentNormalizer.normalize(invalid_enrichment, source_metadata)
        assert content.content_type == "error"
        assert content.quality_score == 0.0
        assert "Error processing content" in content.executive_summary[0]
        
        # Should still be formattable
        template = TemplateRegistry.get_template("general")
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        assert len(blocks) > 0
        assert blocks[0]["type"] == "callout"  # Quality indicator
    
    def test_dynamic_prompt_attribution(self, market_news_enrichment, source_metadata):
        """Test dynamic prompt attribution is preserved through pipeline."""
        # Normalize
        content = ContentNormalizer.normalize(market_news_enrichment, source_metadata)
        
        # Check attribution
        assert content.attribution.prompt_name == "market_impact_analyzer"
        assert content.attribution.prompt_version == "3.1"
        assert content.attribution.prompt_source == "notion"
        
        # Build blocks
        template = TemplateRegistry.get_template(content.content_type)
        builder = AdaptiveBlockBuilder(Platform.DESKTOP)
        blocks = builder.build_blocks(content, template)
        
        # Attribution should be in a toggle
        toggle_blocks = [b for b in blocks if b.get("type") == "toggle"]
        attribution_toggle = next((b for b in toggle_blocks if "Attribution" in str(b)), None)
        assert attribution_toggle is not None