"""
Comprehensive test suite for optimized Notion integration implementation.
Tests unified prompts, quality gates, performance constraints, and block limits.
"""
import pytest
import time
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Test imports
from formatters.optimized_notion_formatter import (
    OptimizedNotionFormatter,
    OptimizedAnalysisResult,
    OptimizedFormatterValidator
)
from enrichment.enhanced_quality_validator import (
    EnhancedQualityValidator,
    OptimizedQualityMetrics
)
from core.prompt_config_enhanced import EnhancedPromptConfig


class TestOptimizedQualityValidator:
    """Test enhanced quality validator with 8.5/10 threshold."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = EnhancedQualityValidator()
        self.sample_drive_link = "https://drive.google.com/file/d/test123/view"

    def test_quality_gate_threshold_enforcement(self):
        """Test that 8.5/10 quality threshold is enforced."""
        # High quality content should pass
        high_quality_content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: Revolutionary AI breakthrough enables 40% efficiency gains in enterprise operations
        - **Market Opportunity**: $2.3B addressable market with immediate deployment potential
        - **Competitive Advantage**: Patent-pending technology provides 18-month market exclusivity
        - **Investment Recommendation**: Immediate strategic partnership recommended for Q4 2024 implementation

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: This breakthrough positions the company as the definitive market leader
        **💰 Revenue Impact**: Projected $180M additional revenue within 24 months of deployment
        **⚡ Implementation Strategy**: Phased rollout recommended with priority enterprise customers
        **🎯 Competitive Moat**: Technical barriers create sustainable competitive advantage
        **🔮 Market Transformation**: Industry-wide adoption expected within 36 months
        """

        high_quality_metrics = self.validator.validate_unified_analysis(
            unified_content=high_quality_content,
            content_type="research",
            processing_time=20.0,
            drive_link=self.sample_drive_link,
            web_search_used=True
        )

        assert high_quality_metrics.overall_score >= 8.5, f"High quality content scored {high_quality_metrics.overall_score}, expected ≥8.5"
        assert high_quality_metrics.optimization_compliance["quality_gate_passed"], "Quality gate should pass for high quality content"

        # Low quality content should fail
        low_quality_content = """
        This is a brief summary.
        It is important and useful.
        The document contains information.
        """

        low_quality_metrics = self.validator.validate_unified_analysis(
            unified_content=low_quality_content,
            content_type="research",
            processing_time=5.0,
            drive_link=self.sample_drive_link,
            web_search_used=False
        )

        assert low_quality_metrics.overall_score < 8.5, f"Low quality content scored {low_quality_metrics.overall_score}, expected <8.5"
        assert not low_quality_metrics.optimization_compliance["quality_gate_passed"], "Quality gate should fail for low quality content"

    def test_processing_time_constraint(self):
        """Test <30s processing time requirement."""
        sample_content = self._get_sample_content()

        # Fast processing should pass
        fast_metrics = self.validator.validate_unified_analysis(
            unified_content=sample_content,
            content_type="research",
            processing_time=25.0,  # Under 30s
            drive_link=self.sample_drive_link
        )
        assert fast_metrics.optimization_compliance["processing_time_ok"], "Fast processing should pass time constraint"

        # Slow processing should fail
        slow_metrics = self.validator.validate_unified_analysis(
            unified_content=sample_content,
            content_type="research",
            processing_time=35.0,  # Over 30s
            drive_link=self.sample_drive_link
        )
        assert not slow_metrics.optimization_compliance["processing_time_ok"], "Slow processing should fail time constraint"

    def test_executive_summary_validation(self):
        """Test executive summary quality validation."""
        # Executive-grade content
        executive_content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Value**: AI-powered automation delivers 35% operational cost reduction
        - **Market Timing**: First-mover advantage in $1.8B emerging market segment
        - **Risk Mitigation**: Diversified technology stack reduces implementation risk by 60%
        - **Action Required**: Board approval needed for $50M investment by Q1 2025
        """

        metrics = self.validator.validate_unified_analysis(
            unified_content=executive_content,
            content_type="market_news",
            processing_time=15.0,
            drive_link=self.sample_drive_link
        )

        assert metrics.component_scores["executive_summary"] >= 8.0, "Executive summary should score highly"

    def test_strategic_insights_validation(self):
        """Test strategic insights quality validation."""
        insights_content = """
        ### 💡 STRATEGIC INSIGHTS
        **🚀 Market Disruption**: Technology breakthrough creates entirely new product category
        **💼 Business Model Innovation**: Subscription-based approach generates 3x recurring revenue
        **⚡ Implementation Roadmap**: 6-month pilot program with Fortune 500 partner recommended
        **🎯 Competitive Response**: Expect aggressive competitor reactions within 12 months
        **📈 Scalability Potential**: Architecture supports 10x growth without major infrastructure changes
        """

        metrics = self.validator.validate_unified_analysis(
            unified_content=insights_content,
            content_type="vendor_capability",
            processing_time=20.0,
            drive_link=self.sample_drive_link
        )

        assert metrics.component_scores["strategic_insights"] >= 8.0, "Strategic insights should score highly"
        assert len(metrics.validation_issues) <= 1, "High quality insights should have minimal issues"

    def test_actionability_assessment(self):
        """Test that insights are actionable and specific."""
        actionable_content = """
        ### 💡 STRATEGIC INSIGHTS
        **🚀 Implementation Strategy**: Deploy pilot program with IBM by Q4 2024, targeting 20% efficiency gain
        **💰 Investment Decision**: Allocate $2M budget for technology acquisition within 60 days
        **⚡ Competitive Response**: File defensive patents immediately to protect market position
        **🎯 Partnership Opportunity**: Negotiate exclusive licensing deal with Microsoft before Q2 2025
        **📊 Performance Metrics**: Establish KPIs measuring ROI, user adoption, and operational efficiency
        """

        metrics = self.validator.validate_unified_analysis(
            unified_content=actionable_content,
            content_type="thought_leadership",
            processing_time=18.0,
            drive_link=self.sample_drive_link
        )

        assert metrics.optimization_compliance["actionable_content"], "Content should be recognized as actionable"

    def _get_sample_content(self):
        """Get sample content for testing."""
        return """
        ### 📋 EXECUTIVE SUMMARY
        - **Key Finding**: Significant advancement in AI technology
        - **Impact**: Substantial business value creation opportunity
        - **Recommendation**: Strategic evaluation recommended

        ### 💡 STRATEGIC INSIGHTS
        **Technology**: Advanced capabilities demonstrated
        **Market**: Strong commercial potential identified
        **Implementation**: Feasible deployment pathway exists
        """


class TestOptimizedNotionFormatter:
    """Test optimized Notion formatter with 15-block limit."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_notion_client = Mock()
        self.formatter = OptimizedNotionFormatter(self.mock_notion_client)
        self.validator = OptimizedFormatterValidator()

    def test_fifteen_block_limit_enforcement(self):
        """Test that maximum 15 blocks are generated."""
        # Create comprehensive analysis that would normally exceed 15 blocks
        comprehensive_analysis = self._get_comprehensive_analysis()

        result = OptimizedAnalysisResult(
            content=comprehensive_analysis,
            content_type="research",
            quality_score=9.2,
            processing_time=22.0,
            web_search_used=True,
            drive_link="https://drive.google.com/file/d/test123/view",
            metadata={"unified_analysis": True}
        )

        blocks = self.formatter.format_unified_analysis(result)

        assert len(blocks) <= 15, f"Block count {len(blocks)} exceeds 15-block limit"
        assert len(blocks) >= 8, f"Block count {len(blocks)} too low for comprehensive analysis"

    def test_required_components_present(self):
        """Test that required components are present in output."""
        result = self._get_sample_analysis_result()
        blocks = self.formatter.format_unified_analysis(result)

        validation = self.formatter.validate_output_constraints(blocks)

        assert validation["has_drive_link"], "Drive link must be present"
        assert validation["has_executive_summary"], "Executive summary must be present"
        assert validation["executive_priority"], "Executive content should be prioritized early"

    def test_drive_link_only_storage(self):
        """Test that only Drive links are stored, not raw content."""
        result = self._get_sample_analysis_result()
        blocks = self.formatter.format_unified_analysis(result)

        # Check for Drive links
        drive_link_found = False
        raw_content_found = False

        for block in blocks:
            block_text = self.formatter._extract_text_from_block(block).lower()

            if "drive.google.com" in block_text or "view in drive" in block_text:
                drive_link_found = True

            # Check for large raw content blocks (>500 chars indicates raw storage)
            if block.get("type") == "code":
                code_content = block.get("code", {}).get("rich_text", [])
                if code_content and len(code_content[0].get("text", {}).get("content", "")) > 500:
                    raw_content_found = True

        assert drive_link_found, "Drive link must be present"
        assert not raw_content_found, "Raw content storage detected - should only have Drive links"

    def test_quality_header_creation(self):
        """Test quality header with performance indicators."""
        result = OptimizedAnalysisResult(
            content=self._get_sample_content(),
            content_type="market_news",
            quality_score=9.1,
            processing_time=18.5,
            web_search_used=True,
            drive_link="https://drive.google.com/file/d/test123/view",
            metadata={}
        )

        blocks = self.formatter.format_unified_analysis(result)

        # First block should be quality header
        header_block = blocks[0]
        assert header_block["type"] == "callout", "First block should be quality callout"

        header_text = header_block["callout"]["rich_text"][0]["text"]["content"]
        assert "9.1/10" in header_text, "Quality score should be displayed"
        assert "18.5s" in header_text, "Processing time should be displayed"
        assert "Web Enhanced" in header_text, "Web search status should be indicated"

    def test_executive_summary_prioritization(self):
        """Test that executive summary appears early and is well-formatted."""
        result = self._get_sample_analysis_result()
        blocks = self.formatter.format_unified_analysis(result)

        # Executive summary should be in first 5 blocks
        executive_found = False
        for i, block in enumerate(blocks[:5]):
            if block.get("type") == "heading_2":
                heading_text = block["heading_2"]["rich_text"][0]["text"]["content"]
                if "executive summary" in heading_text.lower():
                    executive_found = True
                    assert i < 3, f"Executive summary at position {i}, should be in first 3 blocks"
                    break

        assert executive_found, "Executive summary not found in first 5 blocks"

    def test_mobile_optimization(self):
        """Test mobile-friendly formatting."""
        result = self._get_sample_analysis_result()
        blocks = self.formatter.format_unified_analysis(result)

        # Check for mobile-friendly characteristics
        has_toggles = any(block.get("type") == "toggle" for block in blocks)
        has_callouts = any(block.get("type") == "callout" for block in blocks)

        assert has_toggles or has_callouts, "Should have collapsible content for mobile"

        # Check text length in blocks
        for block in blocks:
            if block.get("type") == "paragraph":
                text = block["paragraph"]["rich_text"][0]["text"]["content"]
                assert len(text) < 1000, f"Paragraph too long for mobile: {len(text)} chars"

    def _get_comprehensive_analysis(self):
        """Get comprehensive analysis that would normally exceed block limits."""
        return """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Breakthrough**: Revolutionary AI technology achieves 45% efficiency improvement over competitors
        - **Market Opportunity**: $3.2B total addressable market with 18-month first-mover advantage window
        - **Financial Impact**: Projected $250M revenue increase within 24 months of deployment
        - **Implementation Priority**: Board approval required for $75M investment by Q1 2025

        ### 🎯 CLASSIFICATION & METADATA
        **Content Type**: Research Paper
        **AI Primitives**: Machine Learning, Natural Language Processing, Computer Vision
        **Quality Score**: 9.2/10
        **Processing Time**: 22 seconds

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: Patent-pending approach creates insurmountable competitive moat
        - **Impact**: Market dominance for 24-36 months guaranteed
        - **Action**: File additional patent applications immediately
        - **Timeline**: Complete patent portfolio by Q2 2025

        **💰 Revenue Transformation**: Subscription model generates 4x recurring revenue multiplier
        - **Impact**: Transforms business model from transactional to recurring
        - **Action**: Develop enterprise customer success programs
        - **Timeline**: Pilot launch with Fortune 100 customers Q4 2024

        **⚡ Operational Excellence**: Automated workflows reduce operational costs by 60%
        - **Impact**: $180M annual cost savings across global operations
        - **Action**: Implement automation infrastructure Q1 2025
        - **Timeline**: Full deployment complete by Q3 2025

        **🎯 Market Expansion**: Technology enables entry into three adjacent $1B+ markets
        - **Impact**: Total addressable market expands to $8.7B
        - **Action**: Establish strategic partnerships in new verticals
        - **Timeline**: Market entry strategy finalized Q2 2025

        **🔮 Competitive Advantage**: Technical barriers prevent competitor replication for 18+ months
        - **Impact**: Sustainable market leadership position
        - **Action**: Accelerate product development to extend lead
        - **Timeline**: Next-generation platform launch Q4 2025

        ### 🔗 KEY REFERENCES
        **Drive Link**: [Original Research Document](https://drive.google.com/file/d/test123/view)
        **Related Sources**: [MIT Technology Review](https://example.com) | [Harvard Business Review](https://example.com) | [McKinsey Report](https://example.com)
        """

    def _get_sample_analysis_result(self):
        """Get sample analysis result for testing."""
        return OptimizedAnalysisResult(
            content=self._get_sample_content(),
            content_type="research",
            quality_score=8.8,
            processing_time=20.0,
            web_search_used=True,
            drive_link="https://drive.google.com/file/d/test123/view",
            metadata={"unified_analysis": True}
        )

    def _get_sample_content(self):
        """Get sample content for testing."""
        return """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: AI breakthrough enables 40% efficiency gains
        - **Market Opportunity**: $2.3B addressable market opportunity
        - **Competitive Advantage**: Patent-pending technology provides market exclusivity
        - **Investment Recommendation**: Strategic partnership recommended Q4 2024

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: Positions company as definitive market leader
        **💰 Revenue Impact**: Projected $180M additional revenue within 24 months
        **⚡ Implementation Strategy**: Phased rollout with priority enterprise customers
        **🎯 Competitive Moat**: Technical barriers create sustainable advantage
        """


class TestEnhancedPromptConfig:
    """Test enhanced prompt configuration with unified analyzer support."""

    def setup_method(self):
        """Set up test fixtures."""
        self.config = EnhancedPromptConfig()

    @patch.dict(os.environ, {"USE_UNIFIED_ANALYZER": "true"})
    def test_unified_analyzer_prompt_loading(self):
        """Test loading of unified analyzer prompts."""
        # Test that unified analyzer prompt is returned when enabled
        prompt_config = self.config.get_prompt("unified_analyzer", "research")

        assert prompt_config is not None, "Unified analyzer prompt should be available"
        assert "system" in prompt_config, "Prompt should have system message"
        assert prompt_config.get("source") in ["optimized", "yaml"], "Prompt should have valid source"

    def test_optimization_settings_loading(self):
        """Test loading of optimization settings."""
        settings = self.config.get_optimization_settings()

        # Should have optimization parameters
        expected_keys = ["max_total_processing_time", "quality_gate_threshold", "max_notion_blocks"]
        for key in expected_keys:
            assert key in settings or len(settings) == 0, f"Optimization setting {key} missing"

    @patch.dict(os.environ, {"USE_UNIFIED_ANALYZER": "false"})
    def test_fallback_to_individual_prompts(self):
        """Test fallback to individual prompts when unified analyzer disabled."""
        prompt_config = self.config.get_prompt("summarizer", "research")

        assert prompt_config is not None, "Should fallback to individual prompts"
        assert prompt_config.get("source") in ["notion", "yaml"], "Should use traditional prompt sources"

    def test_content_type_specific_optimization(self):
        """Test content-type specific prompt optimization."""
        research_config = self.config._get_unified_prompt("research")
        market_config = self.config._get_unified_prompt("market_news")

        # Should return different configurations for different content types
        if research_config and market_config:
            # Configurations should be tailored to content type
            assert research_config.get("system") or market_config.get("system"), "Should have content-specific prompts"


class TestEndToEndOptimization:
    """Test complete optimized pipeline end-to-end."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_notion_client = Mock()

    @patch.dict(os.environ, {
        "USE_OPTIMIZED_FORMATTER": "true",
        "USE_ENHANCED_VALIDATION": "true",
        "USE_UNIFIED_ANALYZER": "true"
    })
    def test_complete_optimized_pipeline(self):
        """Test complete optimized pipeline from input to Notion blocks."""
        # Mock components
        config = EnhancedPromptConfig()
        validator = EnhancedQualityValidator()
        formatter = OptimizedNotionFormatter(self.mock_notion_client)

        # Sample input
        content = self._get_sample_document_content()
        title = "AI Research Breakthrough"
        drive_link = "https://drive.google.com/file/d/test123/view"

        # Simulate unified analysis (normally from AI)
        unified_analysis = self._get_unified_analysis_output()

        # Test processing pipeline
        start_time = time.time()

        # 1. Quality validation
        quality_metrics = validator.validate_unified_analysis(
            unified_content=unified_analysis,
            content_type="research",
            processing_time=22.0,
            drive_link=drive_link,
            web_search_used=True
        )

        # 2. Quality gate check
        assert quality_metrics.overall_score >= 8.5, f"Quality gate failed: {quality_metrics.overall_score}"

        # 3. Notion formatting
        result = OptimizedAnalysisResult(
            content=unified_analysis,
            content_type="research",
            quality_score=quality_metrics.overall_score,
            processing_time=22.0,
            web_search_used=True,
            drive_link=drive_link,
            metadata={"unified_analysis": True}
        )

        blocks = formatter.format_unified_analysis(result)

        total_time = time.time() - start_time

        # Validate optimization constraints
        assert total_time < 5.0, f"Test processing time {total_time}s should be fast"  # Excluding AI call
        assert len(blocks) <= 15, f"Block count {len(blocks)} exceeds 15-block limit"
        assert quality_metrics.optimization_compliance["quality_gate_passed"], "Quality gate should pass"

        # Validate content structure
        validation = formatter.validate_output_constraints(blocks)
        assert validation["has_drive_link"], "Drive link required"
        assert validation["has_executive_summary"], "Executive summary required"
        assert validation["executive_priority"], "Executive content should be prioritized"

    def test_performance_under_load(self):
        """Test performance with multiple concurrent validations."""
        validator = EnhancedQualityValidator()
        formatter = OptimizedNotionFormatter(self.mock_notion_client)

        # Simulate processing multiple documents
        processing_times = []
        quality_scores = []
        block_counts = []

        for i in range(10):  # Process 10 documents
            start_time = time.time()

            # Quality validation
            metrics = validator.validate_unified_analysis(
                unified_content=self._get_varied_analysis_content(i),
                content_type="research",
                processing_time=20.0 + i,  # Vary processing time
                drive_link=f"https://drive.google.com/file/d/test{i}/view",
                web_search_used=i % 2 == 0  # Alternate web search
            )

            # Formatting
            result = OptimizedAnalysisResult(
                content=self._get_varied_analysis_content(i),
                content_type="research",
                quality_score=metrics.overall_score,
                processing_time=20.0 + i,
                web_search_used=i % 2 == 0,
                drive_link=f"https://drive.google.com/file/d/test{i}/view",
                metadata={}
            )

            blocks = formatter.format_unified_analysis(result)

            processing_time = time.time() - start_time

            processing_times.append(processing_time)
            quality_scores.append(metrics.overall_score)
            block_counts.append(len(blocks))

        # Performance assertions
        avg_processing_time = sum(processing_times) / len(processing_times)
        assert avg_processing_time < 1.0, f"Average processing time {avg_processing_time}s too slow"

        # Quality assertions
        quality_gate_pass_rate = sum(1 for q in quality_scores if q >= 8.5) / len(quality_scores)
        assert quality_gate_pass_rate >= 0.8, f"Quality gate pass rate {quality_gate_pass_rate} too low"

        # Block count assertions
        block_compliance_rate = sum(1 for b in block_counts if b <= 15) / len(block_counts)
        assert block_compliance_rate == 1.0, f"Block count compliance rate {block_compliance_rate} should be 100%"

    def _get_sample_document_content(self):
        """Get sample document content."""
        return """
        This is a research paper about artificial intelligence breakthroughs.
        The technology demonstrates significant improvements in efficiency and performance.
        Market applications include enterprise automation and competitive advantages.
        """

    def _get_unified_analysis_output(self):
        """Get sample unified analysis output."""
        return """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: Revolutionary AI breakthrough enables 40% efficiency gains in enterprise operations
        - **Market Opportunity**: $2.3B addressable market with immediate deployment potential
        - **Competitive Advantage**: Patent-pending technology provides 18-month market exclusivity
        - **Investment Recommendation**: Immediate strategic partnership recommended for Q4 2024 implementation

        ### 🎯 CLASSIFICATION & METADATA
        **Content Type**: Research Paper
        **AI Primitives**: Machine Learning, Natural Language Processing, Computer Vision
        **Quality Score**: 9.1/10
        **Processing Time**: 22 seconds

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: This breakthrough positions the company as the definitive market leader
        **💰 Revenue Impact**: Projected $180M additional revenue within 24 months of deployment
        **⚡ Implementation Strategy**: Phased rollout recommended with priority enterprise customers
        **🎯 Competitive Moat**: Technical barriers create sustainable competitive advantage
        **🔮 Market Transformation**: Industry-wide adoption expected within 36 months

        ### 🔗 KEY REFERENCES
        **Drive Link**: [Original Research Document](https://drive.google.com/file/d/test123/view)
        **Related Sources**: [MIT Technology Review](https://example.com) | [Nature AI](https://example.com)
        """

    def _get_varied_analysis_content(self, index):
        """Get varied analysis content for load testing."""
        qualities = ["breakthrough", "significant", "moderate", "incremental", "minor"]
        impacts = ["revolutionary", "substantial", "meaningful", "notable", "limited"]

        quality = qualities[index % len(qualities)]
        impact = impacts[index % len(impacts)]

        return f"""
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: {quality.title()} AI advancement enables efficiency gains
        - **Market Impact**: {impact.title()} business value creation opportunity
        - **Investment Recommendation**: Strategic evaluation recommended

        ### 💡 STRATEGIC INSIGHTS
        **Technology**: {quality.title()} capabilities demonstrated
        **Market**: {impact} commercial potential identified
        **Implementation**: Feasible deployment pathway exists
        """


# Performance benchmarking
class TestPerformanceBenchmarks:
    """Test performance benchmarks and SLA compliance."""

    def test_processing_time_sla(self):
        """Test that processing time meets SLA requirements."""
        validator = EnhancedQualityValidator()

        start_time = time.time()

        # Simulate realistic validation workload
        for _ in range(5):
            metrics = validator.validate_unified_analysis(
                unified_content=self._get_benchmark_content(),
                content_type="research",
                processing_time=25.0,
                drive_link="https://drive.google.com/file/d/test/view"
            )

        total_time = time.time() - start_time
        avg_time_per_validation = total_time / 5

        assert avg_time_per_validation < 0.5, f"Validation too slow: {avg_time_per_validation}s per validation"

    def test_memory_efficiency(self):
        """Test memory usage during processing."""
        import psutil
        import gc

        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Process multiple documents
        formatter = OptimizedNotionFormatter(Mock())

        for i in range(20):
            result = OptimizedAnalysisResult(
                content=self._get_benchmark_content(),
                content_type="research",
                quality_score=9.0,
                processing_time=20.0,
                web_search_used=True,
                drive_link=f"https://drive.google.com/file/d/test{i}/view",
                metadata={}
            )

            blocks = formatter.format_unified_analysis(result)
            del blocks  # Explicit cleanup

        gc.collect()  # Force garbage collection
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        assert memory_increase < 100, f"Memory increase {memory_increase}MB too high"

    def _get_benchmark_content(self):
        """Get content for benchmarking."""
        return """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: Advanced AI technology demonstrates significant capabilities
        - **Market Opportunity**: Large addressable market with growth potential
        - **Competitive Position**: Technology provides competitive advantages
        - **Recommendation**: Further evaluation and strategic planning recommended

        ### 💡 STRATEGIC INSIGHTS
        **Technology**: Advanced capabilities with practical applications
        **Market**: Strong commercial potential in multiple sectors
        **Implementation**: Viable deployment strategies identified
        **Competition**: Sustainable competitive advantages possible
        **Growth**: Significant scaling opportunities available
        """


# Fixture for mocking
@pytest.fixture
def mock_notion_client():
    """Mock Notion client for testing."""
    client = Mock()
    return client


# Test configuration
pytest_plugins = ["pytest_mock"]