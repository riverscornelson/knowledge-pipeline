#!/usr/bin/env python3
"""
Validation script to test and enforce 15-block output limits across the optimized pipeline.
"""
import sys
import time
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from formatters.optimized_notion_formatter import (
    OptimizedNotionFormatter,
    OptimizedAnalysisResult,
    OptimizedFormatterValidator
)
from enrichment.enhanced_quality_validator import EnhancedQualityValidator
from utils.logging import setup_logger


class BlockLimitValidator:
    """Validates that all components respect the 15-block output limit."""

    def __init__(self):
        """Initialize validator."""
        self.logger = setup_logger(__name__)
        self.test_results = []
        self.violations = []

    def run_comprehensive_validation(self) -> Dict[str, Any]:
        """
        Run comprehensive validation of 15-block limit across all scenarios.

        Returns:
            Dict with validation results and compliance metrics
        """
        self.logger.info("🔍 Starting comprehensive 15-block limit validation")

        # Test scenarios
        scenarios = [
            self._test_minimal_content,
            self._test_moderate_content,
            self._test_comprehensive_content,
            self._test_maximum_content,
            self._test_edge_cases,
            self._test_different_content_types,
            self._test_varying_quality_scores,
            self._test_web_search_scenarios
        ]

        passed_tests = 0
        total_tests = len(scenarios)

        for scenario in scenarios:
            try:
                result = scenario()
                self.test_results.append(result)
                if result["passed"]:
                    passed_tests += 1
                else:
                    self.violations.append(result)
                    self.logger.warning(f"❌ Test failed: {result['test_name']} - {result['reason']}")
            except Exception as e:
                self.logger.error(f"❌ Test error in {scenario.__name__}: {e}")
                self.violations.append({
                    "test_name": scenario.__name__,
                    "passed": False,
                    "reason": f"Test execution error: {e}",
                    "block_count": None
                })

        # Generate summary
        compliance_rate = passed_tests / total_tests
        summary = {
            "validation_timestamp": datetime.now().isoformat(),
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "compliance_rate": compliance_rate,
            "violations": self.violations,
            "all_results": self.test_results,
            "overall_compliant": compliance_rate == 1.0
        }

        self._log_validation_summary(summary)
        return summary

    def _test_minimal_content(self) -> Dict[str, Any]:
        """Test with minimal content."""
        content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Key Point**: Brief analysis summary
        - **Recommendation**: Basic recommendation

        ### 💡 STRATEGIC INSIGHTS
        **Insight**: Single strategic insight identified
        """

        return self._validate_content_scenario(
            content=content,
            test_name="minimal_content",
            content_type="research",
            quality_score=8.6
        )

    def _test_moderate_content(self) -> Dict[str, Any]:
        """Test with moderate content length."""
        content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Innovation**: AI breakthrough enables 40% efficiency gains
        - **Market Opportunity**: $2.3B addressable market opportunity
        - **Competitive Advantage**: Patent-pending technology provides market exclusivity
        - **Investment Recommendation**: Strategic partnership recommended Q4 2024

        ### 🎯 CLASSIFICATION & METADATA
        **Content Type**: Research Paper
        **AI Primitives**: Machine Learning, Natural Language Processing
        **Quality Score**: 8.8/10

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: Positions company as market leader
        **💰 Revenue Impact**: $180M additional revenue within 24 months
        **⚡ Implementation Strategy**: Phased rollout recommended
        """

        return self._validate_content_scenario(
            content=content,
            test_name="moderate_content",
            content_type="vendor_capability",
            quality_score=8.8
        )

    def _test_comprehensive_content(self) -> Dict[str, Any]:
        """Test with comprehensive content that should still fit in 15 blocks."""
        content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Breakthrough**: Revolutionary AI technology achieves 45% efficiency improvement
        - **Market Opportunity**: $3.2B total addressable market with 18-month advantage window
        - **Financial Impact**: Projected $250M revenue increase within 24 months
        - **Implementation Priority**: Board approval required for $75M investment by Q1 2025

        ### 🎯 CLASSIFICATION & METADATA
        **Content Type**: Research Paper
        **AI Primitives**: Machine Learning, Natural Language Processing, Computer Vision
        **Quality Score**: 9.2/10
        **Processing Time**: 22 seconds

        ### 💡 STRATEGIC INSIGHTS
        **🚀 Technology Leadership**: Patent-pending approach creates competitive moat
        - **Impact**: Market dominance for 24-36 months guaranteed
        - **Action**: File additional patent applications immediately
        - **Timeline**: Complete patent portfolio by Q2 2025

        **💰 Revenue Transformation**: Subscription model generates 4x recurring revenue
        - **Impact**: Transforms business model from transactional to recurring
        - **Action**: Develop enterprise customer success programs
        - **Timeline**: Pilot launch with Fortune 100 customers Q4 2024

        **⚡ Operational Excellence**: Automated workflows reduce operational costs by 60%
        - **Impact**: $180M annual cost savings across global operations
        - **Action**: Implement automation infrastructure Q1 2025
        - **Timeline**: Full deployment complete by Q3 2025

        **🎯 Market Expansion**: Technology enables entry into three adjacent markets
        - **Impact**: Total addressable market expands to $8.7B
        - **Action**: Establish strategic partnerships in new verticals
        - **Timeline**: Market entry strategy finalized Q2 2025

        ### 🔗 KEY REFERENCES
        **Drive Link**: [Original Research Document](https://drive.google.com/file/d/test123/view)
        **Related Sources**: [MIT Technology Review](https://example.com) | [Harvard Business Review](https://example.com)
        """

        return self._validate_content_scenario(
            content=content,
            test_name="comprehensive_content",
            content_type="research",
            quality_score=9.2
        )

    def _test_maximum_content(self) -> Dict[str, Any]:
        """Test with maximum content that would normally exceed limits."""
        content = """
        ### 📋 EXECUTIVE SUMMARY
        - **Strategic Breakthrough**: Revolutionary AI technology achieves unprecedented 45% efficiency improvement over all competitors
        - **Market Opportunity**: $3.2B total addressable market with 18-month first-mover advantage window
        - **Financial Impact**: Projected $250M revenue increase within 24 months of full deployment
        - **Investment Priority**: Board approval required for $75M strategic investment by Q1 2025
        - **Competitive Moat**: Patent-pending technology creates insurmountable barriers to entry

        ### 🎯 CLASSIFICATION & METADATA
        **Content Type**: Research Paper - Advanced AI Technology
        **AI Primitives**: Machine Learning, Natural Language Processing, Computer Vision, Deep Learning
        **Quality Score**: 9.5/10 - Exceptional strategic value
        **Processing Time**: 22 seconds - Within optimization targets
        **Web Search**: Enhanced with current market intelligence

        ### 💡 STRATEGIC INSIGHTS (DETAILED ANALYSIS)
        **🚀 Technology Leadership Position**: Patent-pending approach creates insurmountable competitive moat
        - **Strategic Impact**: Market dominance for 24-36 months guaranteed with no viable competitor response
        - **Immediate Action**: File additional patent applications immediately to strengthen intellectual property portfolio
        - **Implementation Timeline**: Complete comprehensive patent portfolio by Q2 2025
        - **Risk Mitigation**: Establish defensive patent strategy against potential competitor challenges

        **💰 Revenue Transformation Strategy**: Subscription model generates 4x recurring revenue multiplier
        - **Business Model Impact**: Transforms entire business model from transactional to recurring revenue streams
        - **Customer Success Action**: Develop comprehensive enterprise customer success programs and support infrastructure
        - **Go-to-Market Timeline**: Pilot launch with Fortune 100 customers scheduled for Q4 2024
        - **Scaling Strategy**: Full market rollout planned for Q2 2025 with aggressive customer acquisition targets

        **⚡ Operational Excellence Initiative**: Automated workflows reduce operational costs by 60% across all business units
        - **Cost Savings Impact**: $180M annual cost savings across global operations and all major business units
        - **Infrastructure Action**: Implement comprehensive automation infrastructure and change management by Q1 2025
        - **Deployment Timeline**: Full deployment and optimization complete by Q3 2025
        - **Change Management**: Comprehensive employee retraining and organizational restructuring required

        **🎯 Market Expansion Opportunity**: Technology enables strategic entry into three adjacent $1B+ markets
        - **Market Impact**: Total addressable market expands from $3.2B to $8.7B with diversified revenue streams
        - **Partnership Action**: Establish strategic partnerships and joint ventures in new vertical markets
        - **Strategy Timeline**: Market entry strategy finalized and partnerships secured by Q2 2025
        - **Competitive Analysis**: Detailed competitive intelligence and market positioning strategy required

        **🔮 Future Innovation Pipeline**: Next-generation technology development roadmap and competitive advantages
        - **Innovation Impact**: Sustainable technology leadership for 5+ years with continuous competitive advantages
        - **R&D Action**: Accelerate next-generation product development and maintain innovation pipeline
        - **Technology Timeline**: Next-generation platform launch and market introduction scheduled for Q4 2025
        - **Investment Strategy**: Additional $50M R&D investment required to maintain technology leadership position

        ### 🔗 KEY REFERENCES AND DOCUMENTATION
        **Primary Drive Link**: [Original Research Document - Comprehensive Analysis](https://drive.google.com/file/d/test123/view)
        **Supporting Documentation**: [Technical Specifications](https://drive.google.com/file/d/tech456/view)
        **Market Research Sources**: [MIT Technology Review](https://example.com) | [Harvard Business Review](https://example.com) | [McKinsey Global Institute](https://example.com)
        **Competitive Intelligence**: [Gartner Magic Quadrant](https://example.com) | [Forrester Wave Report](https://example.com)
        """

        return self._validate_content_scenario(
            content=content,
            test_name="maximum_content",
            content_type="research",
            quality_score=9.5
        )

    def _test_edge_cases(self) -> Dict[str, Any]:
        """Test edge cases and boundary conditions."""
        # Test with exactly 15 sections that should be compressed
        content = """
        ### 📋 EXECUTIVE SUMMARY
        """ + "\n".join([f"- **Point {i}**: Strategic insight number {i}" for i in range(1, 16)]) + """

        ### 💡 STRATEGIC INSIGHTS
        """ + "\n".join([f"**Insight {i}**: Analysis point {i}" for i in range(1, 11)])

        return self._validate_content_scenario(
            content=content,
            test_name="edge_case_many_sections",
            content_type="research",
            quality_score=8.7
        )

    def _test_different_content_types(self) -> Dict[str, Any]:
        """Test different content types to ensure consistent block limits."""
        content_types = ["research", "market_news", "vendor_capability", "thought_leadership", "technical"]
        results = []

        for content_type in content_types:
            content = f"""
            ### 📋 EXECUTIVE SUMMARY
            - **Strategic Value**: {content_type.title()} analysis summary
            - **Key Finding**: Important insight for {content_type}
            - **Recommendation**: Action items for {content_type}

            ### 💡 STRATEGIC INSIGHTS
            **Primary Insight**: {content_type.title()} specific analysis
            **Secondary Insight**: Additional {content_type} considerations
            **Implementation**: {content_type.title()} deployment strategy
            """

            result = self._validate_content_scenario(
                content=content,
                test_name=f"content_type_{content_type}",
                content_type=content_type,
                quality_score=8.6
            )
            results.append(result)

        # Check if all content types passed
        all_passed = all(r["passed"] for r in results)
        return {
            "test_name": "different_content_types",
            "passed": all_passed,
            "reason": "All content types respect 15-block limit" if all_passed else "Some content types exceeded limit",
            "sub_results": results,
            "block_count": max(r["block_count"] for r in results if r["block_count"])
        }

    def _test_varying_quality_scores(self) -> Dict[str, Any]:
        """Test with varying quality scores."""
        quality_scores = [8.5, 8.8, 9.0, 9.3, 9.5]
        results = []

        for score in quality_scores:
            content = f"""
            ### 📋 EXECUTIVE SUMMARY
            - **Quality Level**: Analysis with {score}/10 quality score
            - **Strategic Value**: {'High' if score >= 9.0 else 'Medium'} value content
            - **Recommendation**: {'Priority' if score >= 9.0 else 'Standard'} implementation

            ### 💡 STRATEGIC INSIGHTS
            **Quality Insight**: {score}/10 rated analysis content
            **Implementation**: Quality-appropriate deployment strategy
            """

            result = self._validate_content_scenario(
                content=content,
                test_name=f"quality_score_{score}",
                content_type="research",
                quality_score=score
            )
            results.append(result)

        all_passed = all(r["passed"] for r in results)
        return {
            "test_name": "varying_quality_scores",
            "passed": all_passed,
            "reason": "All quality levels respect block limits" if all_passed else "Some quality levels exceeded limits",
            "sub_results": results,
            "block_count": max(r["block_count"] for r in results if r["block_count"])
        }

    def _test_web_search_scenarios(self) -> Dict[str, Any]:
        """Test scenarios with and without web search."""
        scenarios = [
            {"web_search": True, "name": "with_web_search"},
            {"web_search": False, "name": "without_web_search"}
        ]
        results = []

        for scenario in scenarios:
            content = f"""
            ### 📋 EXECUTIVE SUMMARY
            - **Research Method**: Analysis {'with web enhancement' if scenario['web_search'] else 'document only'}
            - **Data Sources**: {'Multiple external sources' if scenario['web_search'] else 'Document content only'}
            - **Insights Quality**: {'Enhanced' if scenario['web_search'] else 'Standard'} analysis depth

            ### 💡 STRATEGIC INSIGHTS
            **Research Insight**: {'Web-enhanced' if scenario['web_search'] else 'Document-based'} analysis
            **Market Context**: {'Current market data' if scenario['web_search'] else 'Document context'}
            """

            result = self._validate_content_scenario(
                content=content,
                test_name=scenario["name"],
                content_type="research",
                quality_score=9.0 if scenario['web_search'] else 8.7,
                web_search_used=scenario['web_search']
            )
            results.append(result)

        all_passed = all(r["passed"] for r in results)
        return {
            "test_name": "web_search_scenarios",
            "passed": all_passed,
            "reason": "All web search scenarios respect limits" if all_passed else "Some web search scenarios exceeded limits",
            "sub_results": results,
            "block_count": max(r["block_count"] for r in results if r["block_count"])
        }

    def _validate_content_scenario(self,
                                  content: str,
                                  test_name: str,
                                  content_type: str,
                                  quality_score: float,
                                  web_search_used: bool = True) -> Dict[str, Any]:
        """
        Validate a specific content scenario.

        Args:
            content: Analysis content to format
            test_name: Name of the test scenario
            content_type: Type of content being tested
            quality_score: Quality score for the content
            web_search_used: Whether web search was used

        Returns:
            Dict with test results
        """
        try:
            # Create mock notion client
            from unittest.mock import Mock
            mock_notion_client = Mock()

            # Initialize formatter
            formatter = OptimizedNotionFormatter(mock_notion_client)

            # Create analysis result
            result = OptimizedAnalysisResult(
                content=content,
                content_type=content_type,
                quality_score=quality_score,
                processing_time=20.0,
                web_search_used=web_search_used,
                drive_link=f"https://drive.google.com/file/d/{test_name}/view",
                metadata={"test_scenario": test_name}
            )

            # Format content
            start_time = time.time()
            blocks = formatter.format_unified_analysis(result)
            formatting_time = time.time() - start_time

            # Validate constraints
            validation = formatter.validate_output_constraints(blocks)
            block_count = len(blocks)

            # Check 15-block limit
            passed = block_count <= 15

            return {
                "test_name": test_name,
                "content_type": content_type,
                "quality_score": quality_score,
                "web_search_used": web_search_used,
                "block_count": block_count,
                "formatting_time": formatting_time,
                "passed": passed,
                "reason": f"Block count {block_count} {'within' if passed else 'exceeds'} 15-block limit",
                "validation": validation,
                "content_length": len(content)
            }

        except Exception as e:
            return {
                "test_name": test_name,
                "passed": False,
                "reason": f"Test execution error: {e}",
                "block_count": None,
                "error": str(e)
            }

    def _log_validation_summary(self, summary: Dict[str, Any]):
        """Log validation summary."""
        self.logger.info("="*60)
        self.logger.info("📊 15-BLOCK LIMIT VALIDATION SUMMARY")
        self.logger.info("="*60)

        status = "✅ PASSED" if summary["overall_compliant"] else "❌ FAILED"
        self.logger.info(f"Status: {status}")
        self.logger.info(f"Tests Passed: {summary['passed_tests']}/{summary['total_tests']}")
        self.logger.info(f"Compliance Rate: {summary['compliance_rate']:.1%}")

        if summary["violations"]:
            self.logger.info(f"Violations: {len(summary['violations'])}")
            for violation in summary["violations"]:
                self.logger.info(f"  - {violation['test_name']}: {violation['reason']}")

        # Block count statistics
        block_counts = [r["block_count"] for r in summary["all_results"] if r.get("block_count")]
        if block_counts:
            self.logger.info(f"Block Count Stats:")
            self.logger.info(f"  - Average: {sum(block_counts)/len(block_counts):.1f}")
            self.logger.info(f"  - Maximum: {max(block_counts)}")
            self.logger.info(f"  - Minimum: {min(block_counts)}")

        self.logger.info("="*60)

    def generate_detailed_report(self, summary: Dict[str, Any], output_path: Path = None):
        """Generate detailed validation report."""
        if output_path is None:
            output_path = Path("validation_reports") / f"block_limit_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Enhanced summary with analysis
        enhanced_summary = summary.copy()
        enhanced_summary.update({
            "validation_type": "15_block_limit_enforcement",
            "optimization_target": "max_15_blocks",
            "test_methodology": "comprehensive_scenario_testing",
            "recommendations": self._generate_recommendations(summary)
        })

        with open(output_path, 'w') as f:
            json.dump(enhanced_summary, f, indent=2, default=str)

        self.logger.info(f"📄 Detailed report saved to: {output_path}")
        return output_path

    def _generate_recommendations(self, summary: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on validation results."""
        recommendations = []

        if not summary["overall_compliant"]:
            recommendations.append("Increase content prioritization to ensure critical information fits within 15 blocks")

        # Check for specific patterns in violations
        if summary["violations"]:
            max_violation_blocks = max([v.get("block_count", 0) for v in summary["violations"] if v.get("block_count")])
            if max_violation_blocks > 20:
                recommendations.append("Implement more aggressive content compression for large documents")

        # Performance recommendations
        all_results = summary.get("all_results", [])
        avg_formatting_time = sum([r.get("formatting_time", 0) for r in all_results]) / len(all_results) if all_results else 0
        if avg_formatting_time > 1.0:
            recommendations.append("Optimize formatting performance to reduce processing time")

        if not recommendations:
            recommendations.append("All tests passed - no recommendations needed")

        return recommendations


def main():
    """Main validation script entry point."""
    validator = BlockLimitValidator()

    print("🚀 Starting 15-Block Limit Validation")
    print("="*50)

    # Run comprehensive validation
    summary = validator.run_comprehensive_validation()

    # Generate detailed report
    report_path = validator.generate_detailed_report(summary)

    # Print final status
    if summary["overall_compliant"]:
        print(f"\n✅ SUCCESS: All tests passed! 15-block limit properly enforced.")
        print(f"📊 Compliance Rate: {summary['compliance_rate']:.1%}")
    else:
        print(f"\n❌ FAILURE: {len(summary['violations'])} violations detected.")
        print(f"📊 Compliance Rate: {summary['compliance_rate']:.1%}")
        print("\nViolations:")
        for violation in summary["violations"]:
            print(f"  - {violation['test_name']}: {violation['reason']}")

    print(f"\n📄 Full report: {report_path}")

    # Exit with appropriate code
    return 0 if summary["overall_compliant"] else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)