"""
Enhanced quality validation system with optimized thresholds and performance constraints.
Implements 8.5/10 quality gate and <30s processing requirements.
"""
import re
import json
import time
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from utils.logging import setup_logger


@dataclass
class OptimizedQualityMetrics:
    """Enhanced quality metrics for optimized pipeline."""
    overall_score: float
    component_scores: Dict[str, float]
    performance_score: float
    validation_issues: List[str]
    confidence_level: str
    processing_metadata: Dict[str, Any]
    optimization_compliance: Dict[str, bool]


class EnhancedQualityValidator:
    """
    Enhanced quality validator with optimized thresholds for the unified pipeline.

    Key enhancements:
    - 8.5/10 quality threshold (raised from 6.0)
    - <30s processing time requirement
    - Executive content prioritization
    - Unified prompt compatibility
    - Drive-link-only validation
    """

    def __init__(self):
        """Initialize enhanced quality validator."""
        self.logger = setup_logger(__name__)

        # Enhanced quality thresholds
        self.QUALITY_GATE_THRESHOLD = 8.5  # Raised from 6.0
        self.EXCELLENT_THRESHOLD = 9.0
        self.PROCESSING_TIME_LIMIT = 30.0  # seconds
        self.MIN_ACTIONABLE_INSIGHTS = 3
        self.MAX_GENERIC_CONTENT_RATIO = 0.2

        # Optimization criteria weights
        self.criteria_weights = {
            "executive_value": 0.30,        # Prioritize executive-level insights
            "actionability": 0.25,          # Must be actionable
            "specificity": 0.20,            # Specific, not generic
            "strategic_relevance": 0.15,    # Strategic value
            "completeness": 0.10            # Completeness
        }

        # Performance validation
        self.performance_weights = {
            "processing_speed": 0.4,        # <30s requirement
            "content_efficiency": 0.3,     # Information density
            "structural_quality": 0.3      # Output structure
        }

    def validate_unified_analysis(self,
                                 unified_content: str,
                                 content_type: str,
                                 processing_time: float,
                                 drive_link: str,
                                 web_search_used: bool = False) -> OptimizedQualityMetrics:
        """
        Validate unified analysis result against enhanced quality standards.

        Args:
            unified_content: Output from unified analyzer
            content_type: Type of content analyzed
            processing_time: Time taken for analysis
            drive_link: Google Drive link to original
            web_search_used: Whether web search was utilized

        Returns:
            OptimizedQualityMetrics with comprehensive assessment
        """
        validation_start = datetime.now()

        # Parse unified content into components
        components = self._parse_unified_content(unified_content)

        # Component-wise validation with enhanced criteria
        executive_score = self._validate_executive_summary(
            components.get("executive_summary", ""),
            content_type
        )

        insights_score = self._validate_strategic_insights(
            components.get("strategic_insights", ""),
            content_type
        )

        classification_score = self._validate_classification_quality(
            components.get("classification", "")
        )

        structure_score = self._validate_content_structure(
            unified_content,
            components
        )

        # Performance validation
        performance_score = self._validate_performance_metrics(
            processing_time,
            len(unified_content),
            web_search_used
        )

        # Component scores
        component_scores = {
            "executive_summary": executive_score,
            "strategic_insights": insights_score,
            "classification": classification_score,
            "content_structure": structure_score,
            "performance": performance_score
        }

        # Calculate weighted overall score
        overall_score = (
            executive_score * self.criteria_weights["executive_value"] +
            insights_score * self.criteria_weights["actionability"] +
            classification_score * self.criteria_weights["specificity"] +
            structure_score * self.criteria_weights["strategic_relevance"] +
            performance_score * self.criteria_weights["completeness"]
        )

        # Optimization compliance checks
        optimization_compliance = self._check_optimization_compliance(
            unified_content,
            processing_time,
            drive_link,
            overall_score
        )

        # Identify validation issues
        validation_issues = self._identify_enhanced_validation_issues(
            components,
            component_scores,
            processing_time,
            optimization_compliance
        )

        # Determine confidence level
        confidence_level = self._calculate_enhanced_confidence(
            overall_score,
            validation_issues,
            optimization_compliance
        )

        # Processing metadata
        processing_duration = (datetime.now() - validation_start).total_seconds()
        metadata = {
            "validation_timestamp": validation_start.isoformat(),
            "validation_time_ms": processing_duration * 1000,
            "content_length": len(unified_content),
            "processing_time": processing_time,
            "web_search_used": web_search_used,
            "component_count": len(components),
            "quality_gate_threshold": self.QUALITY_GATE_THRESHOLD
        }

        quality_metrics = OptimizedQualityMetrics(
            overall_score=overall_score,
            component_scores=component_scores,
            performance_score=performance_score,
            validation_issues=validation_issues,
            confidence_level=confidence_level,
            processing_metadata=metadata,
            optimization_compliance=optimization_compliance
        )

        self._log_enhanced_validation_results(quality_metrics, content_type)

        return quality_metrics

    def _parse_unified_content(self, content: str) -> Dict[str, str]:
        """Parse unified analysis content into components."""
        components = {}

        # Executive Summary
        exec_match = re.search(
            r'### 📋 EXECUTIVE SUMMARY.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if exec_match:
            components["executive_summary"] = exec_match.group(1).strip()

        # Classification & Metadata
        class_match = re.search(
            r'### 🎯 CLASSIFICATION & METADATA.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if class_match:
            components["classification"] = class_match.group(1).strip()

        # Strategic Insights
        insights_match = re.search(
            r'### 💡 STRATEGIC INSIGHTS.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if insights_match:
            components["strategic_insights"] = insights_match.group(1).strip()

        # Key References
        ref_match = re.search(
            r'### 🔗 KEY REFERENCES.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if ref_match:
            components["references"] = ref_match.group(1).strip()

        return components

    def _validate_executive_summary(self, summary: str, content_type: str) -> float:
        """Validate executive summary with enhanced criteria."""
        if not summary:
            return 0.0

        score = 10.0  # Start with perfect score

        # Length appropriateness - executive summaries should be concise
        optimal_length_range = (200, 800)  # Tightened range
        if len(summary) < optimal_length_range[0]:
            score -= 2.0  # Insufficient detail
        elif len(summary) > optimal_length_range[1]:
            score -= 1.5  # Too verbose for executive level

        # Executive language indicators
        executive_indicators = [
            "strategic", "value", "impact", "opportunity", "risk",
            "competitive", "market", "business", "growth", "investment",
            "decision", "advantage", "transformation", "innovation"
        ]
        executive_language_score = sum(
            1 for indicator in executive_indicators
            if indicator in summary.lower()
        ) / len(executive_indicators)
        score = score * 0.7 + executive_language_score * 10 * 0.3

        # Actionability check - executives need actionable insights
        action_words = [
            "should", "recommend", "opportunity", "implement",
            "consider", "leverage", "optimize", "strategy", "action"
        ]
        actionability = sum(
            1 for word in action_words
            if word in summary.lower()
        ) / len(action_words)
        score = score * 0.8 + actionability * 10 * 0.2

        # Quantification bonus - executives like numbers
        quantification_indicators = [
            r'\d+%', r'\$\d+', r'\d+x', r'\d+\.\d+',
            'million', 'billion', 'thousand', 'growth', 'increase', 'decrease'
        ]
        quantification_count = sum(
            1 for pattern in quantification_indicators
            if re.search(pattern, summary, re.IGNORECASE)
        )
        if quantification_count > 0:
            score += min(1.0, quantification_count * 0.5)

        # Structure check - should have clear bullets or structure
        has_structure = bool(re.search(r'[•\-\*]|^\d+\.', summary, re.MULTILINE))
        if not has_structure:
            score -= 1.0

        return max(0.0, min(10.0, score))

    def _validate_strategic_insights(self, insights: str, content_type: str) -> float:
        """Validate strategic insights with enhanced actionability focus."""
        if not insights:
            return 0.0

        score = 10.0

        # Parse individual insights
        insight_blocks = self._extract_insight_blocks(insights)

        if len(insight_blocks) < self.MIN_ACTIONABLE_INSIGHTS:
            score -= 3.0  # Insufficient insights

        # Validate each insight
        insight_scores = []
        for insight in insight_blocks[:5]:  # Max 5 insights
            insight_score = self._validate_individual_insight(insight, content_type)
            insight_scores.append(insight_score)

        if insight_scores:
            avg_insight_score = sum(insight_scores) / len(insight_scores)
            score = score * 0.8 + avg_insight_score * 0.2

        # Strategic value indicators
        strategic_indicators = [
            "competitive advantage", "market opportunity", "revenue",
            "cost savings", "efficiency", "transformation", "innovation",
            "disruption", "leadership", "partnership", "investment"
        ]
        strategic_density = sum(
            1 for indicator in strategic_indicators
            if indicator in insights.lower()
        ) / len(strategic_indicators)
        score = score * 0.9 + strategic_density * 10 * 0.1

        # Diversity bonus - different types of insights
        insight_diversity = self._assess_insight_diversity(insights)
        score = score * 0.95 + insight_diversity * 10 * 0.05

        return max(0.0, min(10.0, score))

    def _validate_individual_insight(self, insight: str, content_type: str) -> float:
        """Validate individual insight quality."""
        score = 10.0

        # Length check
        if len(insight) < 50:
            score -= 3.0  # Too brief
        elif len(insight) > 500:
            score -= 1.0  # Too verbose

        # Actionability
        action_indicators = [
            "should", "could", "recommend", "opportunity", "consider",
            "implement", "leverage", "optimize", "strategy", "action",
            "next step", "immediate", "urgent"
        ]
        actionability = sum(
            1 for indicator in action_indicators
            if indicator in insight.lower()
        ) / len(action_indicators)
        score = score * 0.6 + actionability * 10 * 0.4

        # Specificity vs. genericity
        generic_phrases = [
            "it is important", "very significant", "should consider",
            "plays a role", "could be useful", "might be beneficial",
            "is crucial", "essential to", "key factor"
        ]
        generic_penalty = sum(
            0.5 for phrase in generic_phrases
            if phrase in insight.lower()
        )
        score -= min(generic_penalty, 2.0)

        # Evidence indicators
        evidence_indicators = [
            "data shows", "research indicates", "studies reveal",
            "analysis suggests", "metrics demonstrate", "according to"
        ]
        has_evidence = any(
            indicator in insight.lower()
            for indicator in evidence_indicators
        )
        if has_evidence:
            score += 0.5

        return max(0.0, min(10.0, score))

    def _validate_classification_quality(self, classification: str) -> float:
        """Validate classification and metadata quality."""
        if not classification:
            return 5.0  # Neutral score for missing classification

        score = 10.0

        # Check for required classification fields
        required_fields = [
            "content type", "ai primitives", "quality score"
        ]
        found_fields = sum(
            1 for field in required_fields
            if field in classification.lower()
        )
        field_completeness = found_fields / len(required_fields)
        score = score * field_completeness

        # Quality score self-assessment
        quality_match = re.search(r'quality score.*?(\d+(?:\.\d+)?)', classification, re.IGNORECASE)
        if quality_match:
            self_assessed_quality = float(quality_match.group(1))
            if self_assessed_quality >= 8.0:
                score += 0.5
            elif self_assessed_quality < 6.0:
                score -= 1.0

        # AI primitives relevance
        ai_primitives_match = re.search(r'ai primitives.*?:\s*([^\n]+)', classification, re.IGNORECASE)
        if ai_primitives_match:
            primitives_text = ai_primitives_match.group(1)
            # Check for meaningful AI primitives (not just generic ones)
            meaningful_primitives = [
                "natural language processing", "machine learning", "computer vision",
                "deep learning", "generative ai", "automation", "nlp", "ml"
            ]
            has_meaningful = any(
                prim in primitives_text.lower()
                for prim in meaningful_primitives
            )
            if has_meaningful:
                score += 0.5

        return max(0.0, min(10.0, score))

    def _validate_content_structure(self, content: str, components: Dict[str, str]) -> float:
        """Validate overall content structure and organization."""
        score = 10.0

        # Component completeness
        required_components = ["executive_summary", "strategic_insights"]
        found_components = sum(
            1 for comp in required_components
            if comp in components and components[comp]
        )
        if found_components < len(required_components):
            score -= 3.0

        # Structure indicators
        has_headers = bool(re.search(r'###\s+', content))
        has_bullets = bool(re.search(r'[•\-\*]', content))
        has_formatting = bool(re.search(r'\*\*[^*]+\*\*', content))

        structure_elements = sum([has_headers, has_bullets, has_formatting])
        if structure_elements < 2:
            score -= 2.0

        # Length appropriateness for unified analysis
        optimal_length = (1000, 4000)  # Comprehensive but concise
        if len(content) < optimal_length[0]:
            score -= 2.0
        elif len(content) > optimal_length[1]:
            score -= 1.0

        # Information density
        sentences = content.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        if avg_sentence_length < 10:  # Too terse
            score -= 1.0
        elif avg_sentence_length > 25:  # Too verbose
            score -= 1.0

        return max(0.0, min(10.0, score))

    def _validate_performance_metrics(self,
                                    processing_time: float,
                                    content_length: int,
                                    web_search_used: bool) -> float:
        """Validate performance against optimization targets."""
        score = 10.0

        # Processing time constraint
        if processing_time > self.PROCESSING_TIME_LIMIT:
            time_penalty = (processing_time - self.PROCESSING_TIME_LIMIT) / self.PROCESSING_TIME_LIMIT
            score -= min(5.0, time_penalty * 5.0)

        # Content efficiency (information per second)
        if processing_time > 0:
            content_per_second = content_length / processing_time
            if content_per_second < 50:  # Inefficient processing
                score -= 1.0
            elif content_per_second > 200:  # Very efficient
                score += 0.5

        # Web search timing bonus/penalty
        if web_search_used:
            if processing_time < 25:  # Fast even with web search
                score += 0.5
            elif processing_time > 35:  # Slow with web search
                score -= 1.0

        return max(0.0, min(10.0, score))

    def _check_optimization_compliance(self,
                                     content: str,
                                     processing_time: float,
                                     drive_link: str,
                                     overall_score: float) -> Dict[str, bool]:
        """Check compliance with optimization requirements."""
        compliance = {
            "quality_gate_passed": overall_score >= self.QUALITY_GATE_THRESHOLD,
            "processing_time_ok": processing_time < self.PROCESSING_TIME_LIMIT,
            "has_executive_content": "executive summary" in content.lower(),
            "has_strategic_insights": "strategic insights" in content.lower(),
            "has_drive_link": bool(drive_link and drive_link.strip()),
            "structured_output": bool(re.search(r'###\s+', content)),
            "actionable_content": self._has_actionable_content(content)
        }

        return compliance

    def _has_actionable_content(self, content: str) -> bool:
        """Check if content has actionable insights."""
        action_indicators = [
            "should", "recommend", "opportunity", "implement",
            "consider", "leverage", "optimize", "action", "strategy"
        ]
        action_count = sum(
            content.lower().count(indicator)
            for indicator in action_indicators
        )
        return action_count >= 3  # At least 3 action-oriented terms

    def _extract_insight_blocks(self, insights: str) -> List[str]:
        """Extract individual insight blocks."""
        blocks = []

        # Look for structured insights with emojis or bullets
        patterns = [
            r'\*\*🚀[^*]+\*\*:[^🚀]*(?=\*\*🚀|\Z)',  # Emoji-prefixed insights
            r'\*\*[^*]+\*\*:[^*]*(?=\*\*|\Z)',       # Bold insights
            r'^\d+\.[^\d]*(?=^\d+\.|\Z)',             # Numbered insights
            r'^[•\-\*][^•\-\*]*(?=^[•\-\*]|\Z)'      # Bulleted insights
        ]

        for pattern in patterns:
            matches = re.finditer(pattern, insights, re.MULTILINE | re.DOTALL)
            for match in matches:
                block = match.group(0).strip()
                if len(block) > 30:  # Filter out very short blocks
                    blocks.append(block)

        # Fallback: split by double newlines
        if not blocks:
            blocks = [block.strip() for block in insights.split('\n\n') if len(block.strip()) > 30]

        return blocks[:5]  # Max 5 insights

    def _assess_insight_diversity(self, insights: str) -> float:
        """Assess diversity of insight types."""
        insight_categories = {
            "opportunity": ["opportunity", "potential", "growth", "expand"],
            "risk": ["risk", "threat", "challenge", "concern"],
            "technical": ["technology", "implementation", "system"],
            "financial": ["revenue", "cost", "investment", "roi"],
            "strategic": ["strategy", "competitive", "advantage"],
            "operational": ["process", "efficiency", "workflow"]
        }

        found_categories = set()
        insights_lower = insights.lower()

        for category, keywords in insight_categories.items():
            if any(keyword in insights_lower for keyword in keywords):
                found_categories.add(category)

        diversity_score = len(found_categories) / len(insight_categories)
        return min(1.0, diversity_score * 1.2)  # Slight bonus for good diversity

    def _identify_enhanced_validation_issues(self,
                                           components: Dict[str, str],
                                           component_scores: Dict[str, float],
                                           processing_time: float,
                                           optimization_compliance: Dict[str, bool]) -> List[str]:
        """Identify specific validation issues with enhanced criteria."""
        issues = []

        # Quality gate issues
        if not optimization_compliance["quality_gate_passed"]:
            issues.append(f"Overall quality below {self.QUALITY_GATE_THRESHOLD}/10 threshold")

        # Performance issues
        if processing_time > self.PROCESSING_TIME_LIMIT:
            issues.append(f"Processing time {processing_time:.1f}s exceeds {self.PROCESSING_TIME_LIMIT}s limit")

        # Component-specific issues
        if component_scores["executive_summary"] < 7.0:
            issues.append("Executive summary lacks strategic value or actionability")

        if component_scores["strategic_insights"] < 7.0:
            insights_content = components.get("strategic_insights", "")
            insight_count = len(self._extract_insight_blocks(insights_content))
            if insight_count < self.MIN_ACTIONABLE_INSIGHTS:
                issues.append(f"Insufficient actionable insights ({insight_count} < {self.MIN_ACTIONABLE_INSIGHTS})")

        # Structure issues
        if not optimization_compliance["structured_output"]:
            issues.append("Content lacks proper structure and formatting")

        # Missing components
        if not optimization_compliance["has_executive_content"]:
            issues.append("Missing executive summary section")

        if not optimization_compliance["has_drive_link"]:
            issues.append("Missing Drive link - raw content storage detected")

        return issues

    def _calculate_enhanced_confidence(self,
                                     overall_score: float,
                                     issues: List[str],
                                     compliance: Dict[str, bool]) -> str:
        """Calculate confidence level with enhanced criteria."""
        # Base confidence on quality score
        if overall_score >= self.EXCELLENT_THRESHOLD and len(issues) == 0:
            return "high"
        elif overall_score >= self.QUALITY_GATE_THRESHOLD and len(issues) <= 1:
            return "medium"
        else:
            return "low"

    def _log_enhanced_validation_results(self,
                                       metrics: OptimizedQualityMetrics,
                                       content_type: str):
        """Log enhanced validation results."""
        self.logger.info(
            f"Enhanced quality validation for {content_type}: "
            f"Score={metrics.overall_score:.2f}/{self.QUALITY_GATE_THRESHOLD}, "
            f"Performance={metrics.performance_score:.2f}/10, "
            f"Confidence={metrics.confidence_level}, "
            f"Issues={len(metrics.validation_issues)}"
        )

        # Log compliance status
        compliance_passed = sum(metrics.optimization_compliance.values())
        compliance_total = len(metrics.optimization_compliance)
        self.logger.info(
            f"Optimization compliance: {compliance_passed}/{compliance_total} checks passed"
        )

        # Log performance metrics
        processing_time = metrics.processing_metadata.get("processing_time", 0)
        self.logger.info(
            f"Performance: {processing_time:.1f}s processing time "
            f"({'✓' if processing_time < self.PROCESSING_TIME_LIMIT else '✗'} <{self.PROCESSING_TIME_LIMIT}s)"
        )

        # Log critical issues
        if metrics.validation_issues:
            self.logger.warning("Validation issues detected:")
            for issue in metrics.validation_issues:
                self.logger.warning(f"  - {issue}")

    def is_quality_gate_passed(self, metrics: OptimizedQualityMetrics) -> bool:
        """Check if content passes the enhanced quality gate."""
        return (
            metrics.overall_score >= self.QUALITY_GATE_THRESHOLD and
            metrics.optimization_compliance["quality_gate_passed"] and
            metrics.optimization_compliance["processing_time_ok"] and
            len(metrics.validation_issues) <= 1  # Allow 1 minor issue
        )

    def get_quality_improvement_suggestions(self, metrics: OptimizedQualityMetrics) -> List[str]:
        """Get specific suggestions for quality improvement."""
        suggestions = []

        # Score-based suggestions
        if metrics.component_scores["executive_summary"] < 8.0:
            suggestions.append("Enhance executive summary with more strategic insights and quantifiable impacts")

        if metrics.component_scores["strategic_insights"] < 8.0:
            suggestions.append("Add more actionable strategic insights with specific implementation steps")

        if metrics.performance_score < 8.0:
            suggestions.append("Optimize processing time and content efficiency")

        # Compliance-based suggestions
        if not metrics.optimization_compliance["actionable_content"]:
            suggestions.append("Include more action-oriented language and specific recommendations")

        if not metrics.optimization_compliance["has_drive_link"]:
            suggestions.append("Ensure Drive link is provided and no raw content is stored")

        return suggestions