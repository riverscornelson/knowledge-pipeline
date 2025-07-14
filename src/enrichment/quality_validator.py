"""
Comprehensive quality validation and control system for AI enrichment.
"""
import re
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from ..utils.logging import setup_logger


@dataclass
class QualityMetrics:
    """Container for quality assessment metrics."""
    overall_score: float
    component_scores: Dict[str, float]
    validation_issues: List[str]
    confidence_level: str
    processing_metadata: Dict[str, Any]


class EnrichmentQualityValidator:
    """Comprehensive quality validation system for AI enrichment results."""
    
    def __init__(self):
        """Initialize quality validator with scoring criteria."""
        self.logger = setup_logger(__name__)
        
        # Quality thresholds
        self.min_quality_threshold = 0.6
        self.excellent_quality_threshold = 0.85
        
        # Validation criteria weights
        self.criteria_weights = {
            "content_relevance": 0.25,
            "actionability": 0.20,
            "specificity": 0.20,
            "completeness": 0.15,
            "accuracy": 0.10,
            "consistency": 0.10
        }
    
    def validate_enrichment_results(self, 
                                  summary: str, 
                                  insights: List[str], 
                                  classification: Dict[str, Any],
                                  original_content: str,
                                  title: str) -> QualityMetrics:
        """
        Perform comprehensive quality validation of enrichment results.
        
        Args:
            summary: Generated summary text
            insights: List of generated insights
            classification: Classification results with confidence
            original_content: Original document content
            title: Document title
            
        Returns:
            QualityMetrics with detailed assessment
        """
        validation_start = datetime.now()
        
        # Component-wise validation
        summary_score = self._validate_summary_quality(summary, original_content, title)
        insights_score = self._validate_insights_quality(insights, original_content, title)
        classification_score = self._validate_classification_quality(classification, original_content)
        
        # Cross-component consistency validation
        consistency_score = self._validate_cross_component_consistency(
            summary, insights, classification, original_content
        )
        
        # Aggregate quality scoring
        component_scores = {
            "summary": summary_score,
            "insights": insights_score, 
            "classification": classification_score,
            "consistency": consistency_score
        }
        
        overall_score = (
            summary_score * 0.35 +
            insights_score * 0.35 + 
            classification_score * 0.20 +
            consistency_score * 0.10
        )
        
        # Identify validation issues
        validation_issues = self._identify_validation_issues(
            summary, insights, classification, component_scores
        )
        
        # Determine confidence level
        confidence_level = self._calculate_confidence_level(overall_score, validation_issues)
        
        # Processing metadata
        processing_time = (datetime.now() - validation_start).total_seconds()
        metadata = {
            "validation_timestamp": validation_start.isoformat(),
            "processing_time_ms": processing_time * 1000,
            "content_length": len(original_content),
            "summary_length": len(summary),
            "insights_count": len(insights)
        }
        
        quality_metrics = QualityMetrics(
            overall_score=overall_score,
            component_scores=component_scores,
            validation_issues=validation_issues,
            confidence_level=confidence_level,
            processing_metadata=metadata
        )
        
        self._log_validation_results(quality_metrics, title)
        
        return quality_metrics
    
    def _validate_summary_quality(self, summary: str, content: str, title: str) -> float:
        """Validate summary quality across multiple dimensions."""
        score = 1.0
        
        # Length appropriateness
        optimal_length_range = (400, 1500)
        if len(summary) < optimal_length_range[0]:
            score -= (optimal_length_range[0] - len(summary)) / optimal_length_range[0] * 0.3
        elif len(summary) > optimal_length_range[1]:
            score -= (len(summary) - optimal_length_range[1]) / len(summary) * 0.2
        
        # Content coverage assessment
        coverage_score = self._assess_content_coverage(summary, content)
        score = score * 0.7 + coverage_score * 0.3
        
        # Clarity and structure
        structure_score = self._assess_text_structure(summary)
        score = score * 0.8 + structure_score * 0.2
        
        # Relevance to title
        title_relevance = self._assess_title_relevance(summary, title)
        score = score * 0.9 + title_relevance * 0.1
        
        return max(0.0, min(1.0, score))
    
    def _validate_insights_quality(self, insights: List[str], content: str, title: str) -> float:
        """Validate insights quality focusing on actionability and relevance."""
        if not insights:
            return 0.0
        
        scores = []
        
        for insight in insights:
            insight_score = 1.0
            
            # Actionability assessment
            actionable_indicators = [
                'should', 'could', 'recommend', 'suggest', 'opportunity',
                'risk', 'advantage', 'strategy', 'implement', 'consider',
                'potential', 'enable', 'leverage', 'optimize', 'improve'
            ]
            actionability = sum(1 for indicator in actionable_indicators 
                              if indicator in insight.lower()) / len(actionable_indicators)
            insight_score = insight_score * 0.6 + actionability * 0.4
            
            # Specificity check
            generic_phrases = [
                'it is important', 'very significant', 'many companies',
                'various factors', 'could be useful', 'might be beneficial',
                'should consider', 'is crucial', 'plays a role'
            ]
            generic_penalty = sum(0.1 for phrase in generic_phrases 
                                if phrase in insight.lower())
            insight_score -= min(generic_penalty, 0.3)
            
            # Length appropriateness (not too brief, not too verbose)
            if len(insight) < 30:
                insight_score -= 0.3
            elif len(insight) > 300:
                insight_score -= 0.2
            
            # Content relevance
            relevance_score = self._assess_insight_relevance(insight, content)
            insight_score = insight_score * 0.8 + relevance_score * 0.2
            
            scores.append(max(0.0, insight_score))
        
        # Overall insights quality
        avg_score = sum(scores) / len(scores)
        
        # Diversity bonus (different types of insights)
        diversity_bonus = self._assess_insights_diversity(insights)
        final_score = avg_score * 0.9 + diversity_bonus * 0.1
        
        return max(0.0, min(1.0, final_score))
    
    def _validate_classification_quality(self, classification: Dict[str, Any], content: str) -> float:
        """Validate classification accuracy and confidence."""
        base_score = classification.get("validation_score", 0.7)
        
        # Content type validation
        content_type = classification.get("content_type", "Unknown")
        if content_type == "Unknown":
            base_score -= 0.3
        
        # AI primitives relevance check
        ai_primitives = classification.get("ai_primitives", [])
        if ai_primitives:
            relevance_score = self._assess_ai_primitives_relevance(ai_primitives, content)
            base_score = base_score * 0.7 + relevance_score * 0.3
        
        # Confidence consistency
        confidence = classification.get("confidence", "medium")
        evidence_strength = len(classification.get("evidence", {}).get("content_type_indicators", []))
        
        if confidence == "high" and evidence_strength < 2:
            base_score -= 0.2
        elif confidence == "low" and evidence_strength > 3:
            base_score -= 0.1
        
        return max(0.0, min(1.0, base_score))
    
    def _validate_cross_component_consistency(self, 
                                            summary: str, 
                                            insights: List[str], 
                                            classification: Dict[str, Any],
                                            content: str) -> float:
        """Validate consistency across all enrichment components."""
        consistency_score = 1.0
        
        # Check content type consistency with summary
        content_type = classification.get("content_type", "").lower()
        summary_lower = summary.lower()
        
        type_indicators = {
            "research": ["study", "research", "analysis", "findings", "methodology"],
            "market news": ["market", "company", "announcement", "revenue", "stock"],
            "technical": ["implementation", "architecture", "system", "technical", "code"],
            "opinion": ["opinion", "believe", "think", "perspective", "view"]
        }
        
        if content_type in type_indicators:
            expected_indicators = type_indicators[content_type]
            found_indicators = sum(1 for indicator in expected_indicators 
                                 if indicator in summary_lower)
            if found_indicators == 0:
                consistency_score -= 0.3
        
        # Check AI primitives consistency with insights
        ai_primitives = classification.get("ai_primitives", [])
        insights_text = " ".join(insights).lower()
        
        for primitive in ai_primitives:
            primitive_terms = self._get_primitive_terms(primitive)
            if not any(term in insights_text for term in primitive_terms):
                consistency_score -= 0.1
        
        # Check vendor consistency
        vendor = classification.get("vendor")
        if vendor:
            vendor_lower = vendor.lower()
            if vendor_lower not in summary_lower and not any(vendor_lower in insight.lower() for insight in insights):
                consistency_score -= 0.2
        
        return max(0.0, consistency_score)
    
    def _assess_content_coverage(self, summary: str, content: str) -> float:
        """Assess how well the summary covers the original content."""
        # Extract key terms from content
        content_terms = self._extract_key_terms(content)
        summary_terms = self._extract_key_terms(summary)
        
        if not content_terms:
            return 0.5  # Neutral score if no key terms found
        
        # Calculate coverage ratio
        covered_terms = sum(1 for term in content_terms if term in summary_terms)
        coverage_ratio = covered_terms / len(content_terms)
        
        return min(1.0, coverage_ratio * 1.2)  # Slight bonus for good coverage
    
    def _assess_text_structure(self, text: str) -> float:
        """Assess the structure and clarity of text."""
        score = 1.0
        
        # Sentence structure
        sentences = text.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        
        if avg_sentence_length < 8:  # Too short
            score -= 0.2
        elif avg_sentence_length > 30:  # Too long
            score -= 0.3
        
        # Paragraph structure (for summaries)
        paragraphs = text.split('\n\n')
        if len(paragraphs) < 2:
            score -= 0.1
        
        # Transition words and coherence
        transition_words = ['however', 'therefore', 'furthermore', 'additionally', 'moreover', 'consequently']
        has_transitions = any(word in text.lower() for word in transition_words)
        if has_transitions:
            score += 0.1
        
        return max(0.0, min(1.0, score))
    
    def _assess_title_relevance(self, text: str, title: str) -> float:
        """Assess how relevant the text is to the document title."""
        title_terms = set(title.lower().split())
        text_terms = set(text.lower().split())
        
        # Remove common words
        stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'}
        title_terms -= stop_words
        
        if not title_terms:
            return 0.5
        
        overlap = len(title_terms.intersection(text_terms)) / len(title_terms)
        return min(1.0, overlap * 1.5)
    
    def _assess_insight_relevance(self, insight: str, content: str) -> float:
        """Assess how relevant an insight is to the original content."""
        insight_terms = self._extract_key_terms(insight)
        content_terms = self._extract_key_terms(content)
        
        if not insight_terms or not content_terms:
            return 0.5
        
        overlap = len(set(insight_terms).intersection(set(content_terms)))
        relevance = overlap / max(len(insight_terms), 1)
        
        return min(1.0, relevance * 2)  # Boost for good relevance
    
    def _assess_insights_diversity(self, insights: List[str]) -> float:
        """Assess the diversity of insights (different angles/aspects)."""
        if len(insights) < 2:
            return 0.5
        
        # Check for different types of insights
        insight_types = {
            "opportunity": ["opportunity", "potential", "could", "enable"],
            "risk": ["risk", "threat", "challenge", "danger", "vulnerability"],
            "trend": ["trend", "growing", "increasing", "emerging", "shift"],
            "strategic": ["strategy", "competitive", "advantage", "position"],
            "technical": ["technology", "implementation", "system", "platform"]
        }
        
        found_types = set()
        for insight in insights:
            insight_lower = insight.lower()
            for insight_type, keywords in insight_types.items():
                if any(keyword in insight_lower for keyword in keywords):
                    found_types.add(insight_type)
        
        diversity_score = len(found_types) / len(insight_types)
        return min(1.0, diversity_score * 1.2)
    
    def _assess_ai_primitives_relevance(self, primitives: List[str], content: str) -> float:
        """Assess how relevant identified AI primitives are to the content."""
        if not primitives:
            return 1.0  # No penalty for no primitives
        
        content_lower = content.lower()
        relevance_scores = []
        
        for primitive in primitives:
            terms = self._get_primitive_terms(primitive)
            found_terms = sum(1 for term in terms if term in content_lower)
            relevance = min(1.0, found_terms / max(len(terms), 1) * 2)
            relevance_scores.append(relevance)
        
        return sum(relevance_scores) / len(relevance_scores)
    
    def _get_primitive_terms(self, primitive: str) -> List[str]:
        """Get relevant terms for an AI primitive."""
        primitive_terms = {
            "Natural Language Processing": ["nlp", "text", "language", "semantic", "sentiment", "parsing", "tokenization"],
            "Machine Learning": ["ml", "model", "training", "algorithm", "prediction", "classification", "regression"],
            "Computer Vision": ["vision", "image", "visual", "recognition", "detection", "ocr", "computer vision"],
            "Deep Learning": ["neural", "deep", "tensorflow", "pytorch", "layers", "networks", "deep learning"],
            "Generative AI": ["generative", "generate", "create", "synthesis", "gpt", "llm", "generation"],
            "Automation": ["automate", "automated", "workflow", "process", "efficiency", "automation"]
        }
        
        return primitive_terms.get(primitive, [primitive.lower().replace(" ", "")])
    
    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract key terms from text for comparison."""
        # Simple keyword extraction
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        
        # Remove common words
        stop_words = {'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'after', 'first', 'well', 'many', 'some', 'when', 'much', 'very', 'also', 'only', 'into', 'over', 'such', 'being', 'more', 'most', 'should', 'these'}
        
        filtered_words = [word for word in words if word not in stop_words and len(word) > 4]
        
        # Return top terms by frequency
        from collections import Counter
        term_counts = Counter(filtered_words)
        return [term for term, count in term_counts.most_common(20)]
    
    def _identify_validation_issues(self, 
                                  summary: str, 
                                  insights: List[str], 
                                  classification: Dict[str, Any],
                                  component_scores: Dict[str, float]) -> List[str]:
        """Identify specific validation issues."""
        issues = []
        
        # Summary issues
        if component_scores["summary"] < 0.6:
            if len(summary) < 300:
                issues.append("Summary too brief for adequate coverage")
            if len(summary) > 2000:
                issues.append("Summary too verbose, may lose focus")
        
        # Insights issues
        if component_scores["insights"] < 0.6:
            actionable_count = sum(1 for insight in insights if any(
                term in insight.lower() for term in ['should', 'opportunity', 'risk', 'recommend']
            ))
            if actionable_count < len(insights) * 0.5:
                issues.append("Insights lack sufficient actionability")
        
        # Classification issues
        if component_scores["classification"] < 0.7:
            if classification.get("content_type") == "Unknown":
                issues.append("Content type classification failed")
            if not classification.get("ai_primitives"):
                issues.append("No AI primitives identified despite potential relevance")
        
        # Consistency issues
        if component_scores["consistency"] < 0.7:
            issues.append("Inconsistency detected across enrichment components")
        
        return issues
    
    def _calculate_confidence_level(self, overall_score: float, issues: List[str]) -> str:
        """Calculate confidence level based on score and issues."""
        if overall_score >= self.excellent_quality_threshold and len(issues) == 0:
            return "high"
        elif overall_score >= self.min_quality_threshold and len(issues) <= 2:
            return "medium"
        else:
            return "low"
    
    def _log_validation_results(self, metrics: QualityMetrics, title: str):
        """Log validation results for monitoring."""
        self.logger.info(
            f"Quality validation for '{title}': "
            f"Score={metrics.overall_score:.3f}, "
            f"Confidence={metrics.confidence_level}, "
            f"Issues={len(metrics.validation_issues)}"
        )
        
        if metrics.validation_issues:
            self.logger.debug(f"Validation issues: {metrics.validation_issues}")