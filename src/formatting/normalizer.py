"""
Content normalizer that converts various prompt outputs to normalized models.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from .models import (
    ActionItem,
    ActionPriority,
    Attribution,
    ContentQuality,
    EnrichedContent,
    Insight,
    ProcessingMetrics
)

logger = logging.getLogger(__name__)


class ContentNormalizer:
    """
    Normalizes various prompt output formats into a consistent EnrichedContent model.
    
    This class handles the complexity of different prompt outputs and creates
    a unified structure that can be formatted consistently.
    """
    
    # Common section name mappings
    SECTION_MAPPINGS = {
        # Executive summary variations
        "executive_summary": ["executive_summary", "summary", "core_summary", "overview"],
        "key_insights": ["key_insights", "insights", "key_findings", "main_points"],
        "action_items": ["action_items", "actions", "next_steps", "recommendations"],
        # Analysis sections
        "detailed_analysis": ["detailed_analysis", "analysis", "deep_dive"],
        "strategic_implications": ["strategic_implications", "implications", "impact"],
        "technical_details": ["technical_details", "technical_analysis", "methodology"],
    }
    
    # Priority keyword mappings
    PRIORITY_KEYWORDS = {
        ActionPriority.CRITICAL: ["critical", "urgent", "immediate", "emergency"],
        ActionPriority.HIGH: ["high", "important", "priority", "significant"],
        ActionPriority.MEDIUM: ["medium", "moderate", "normal", "standard"],
        ActionPriority.LOW: ["low", "minor", "optional", "nice-to-have"],
    }
    
    @classmethod
    def normalize(
        cls,
        enrichment_result: Dict[str, Any],
        source_metadata: Dict[str, Any]
    ) -> EnrichedContent:
        """
        Normalize enrichment results into a consistent EnrichedContent model.
        
        Args:
            enrichment_result: Raw output from enrichment service
            source_metadata: Metadata about the source document
            
        Returns:
            Normalized EnrichedContent instance
        """
        try:
            # Extract core components
            content_analysis = enrichment_result.get("content_analysis", {})
            metadata = enrichment_result.get("metadata", {})
            
            # Parse executive summary
            executive_summary = cls._extract_executive_summary(content_analysis)
            
            # Parse insights
            key_insights = cls._extract_insights(content_analysis)
            
            # Parse action items
            action_items = cls._extract_action_items(content_analysis)
            
            # Extract quality metrics (handle string values)
            quality_score = metadata.get("quality_score", 0.5)
            if isinstance(quality_score, str):
                try:
                    quality_score = float(quality_score)
                except ValueError:
                    quality_score = 0.5
            quality_level = EnrichedContent.calculate_quality_level(quality_score)
            
            # Build attribution
            attribution = cls._build_attribution(enrichment_result, metadata)
            
            # Build processing metrics
            processing_metrics = cls._build_processing_metrics(metadata)
            
            # Collect all other sections into raw_sections
            raw_sections = cls._collect_raw_sections(content_analysis)
            
            # Extract raw content info
            raw_content = source_metadata.get("raw_content", "")
            raw_content_size = len(raw_content.encode('utf-8')) if raw_content else 0
            
            return EnrichedContent(
                # Content identification
                content_type=metadata.get("content_type", "general"),
                source_id=source_metadata.get("id", ""),
                source_title=source_metadata.get("title", "Untitled"),
                
                # Quality
                quality_score=quality_score,
                quality_level=quality_level,
                
                # Core sections
                executive_summary=executive_summary,
                key_insights=key_insights,
                action_items=action_items,
                
                # Flexible sections
                raw_sections=raw_sections,
                
                # Metadata
                attribution=attribution,
                processing_metrics=processing_metrics,
                
                # Original content
                raw_content=raw_content if len(raw_content) < 10000 else None,
                raw_content_size_bytes=raw_content_size,
                
                # Additional properties
                tags=source_metadata.get("tags", []),
                url=source_metadata.get("url"),
            )
            
        except Exception as e:
            logger.error(f"Error normalizing content: {e}")
            # Return a minimal valid object on error
            return cls._create_error_content(enrichment_result, source_metadata, str(e))
    
    @classmethod
    def _extract_executive_summary(cls, content_analysis: Dict[str, Any]) -> List[str]:
        """Extract executive summary points from various possible locations."""
        # Try different section names
        for section_name in cls.SECTION_MAPPINGS["executive_summary"]:
            if section_name in content_analysis:
                summary = content_analysis[section_name]
                if isinstance(summary, list):
                    return summary[:5]  # Max 5 points
                elif isinstance(summary, str):
                    # Split by newlines or periods
                    points = [p.strip() for p in summary.split('\n') if p.strip()]
                    if len(points) < 3:
                        points = [p.strip() + '.' for p in summary.split('.') if p.strip()]
                    return points[:5]
        
        # Fallback: try to extract from key insights
        insights = cls._extract_insights(content_analysis)
        if insights:
            return [insight.text for insight in insights[:3]]
        
        return ["No executive summary available"]
    
    @classmethod
    def _extract_insights(cls, content_analysis: Dict[str, Any]) -> List[Insight]:
        """Extract insights from various possible locations."""
        insights = []
        
        # Try different section names
        for section_name in cls.SECTION_MAPPINGS["key_insights"]:
            if section_name in content_analysis:
                raw_insights = content_analysis[section_name]
                
                if isinstance(raw_insights, list):
                    for item in raw_insights:
                        if isinstance(item, dict):
                            insights.append(Insight(
                                text=item.get("text", str(item)),
                                confidence=item.get("confidence", 1.0),
                                supporting_evidence=item.get("evidence"),
                                tags=item.get("tags", [])
                            ))
                        else:
                            insights.append(Insight(text=str(item)))
                            
                elif isinstance(raw_insights, str):
                    # Split by newlines
                    for line in raw_insights.split('\n'):
                        if line.strip():
                            insights.append(Insight(text=line.strip()))
        
        return insights
    
    @classmethod
    def _extract_action_items(cls, content_analysis: Dict[str, Any]) -> List[ActionItem]:
        """Extract action items from various possible locations."""
        actions = []
        
        # Try different section names
        for section_name in cls.SECTION_MAPPINGS["action_items"]:
            if section_name in content_analysis:
                raw_actions = content_analysis[section_name]
                
                if isinstance(raw_actions, list):
                    for item in raw_actions:
                        if isinstance(item, dict):
                            actions.append(ActionItem(
                                text=item.get("text", str(item)),
                                priority=cls._parse_priority(item.get("priority", "medium")),
                                due_date=cls._parse_date(item.get("due_date")),
                                assignee=item.get("assignee"),
                                context=item.get("context")
                            ))
                        else:
                            # Parse priority from text
                            priority = cls._detect_priority_from_text(str(item))
                            actions.append(ActionItem(
                                text=str(item),
                                priority=priority
                            ))
                            
                elif isinstance(raw_actions, str):
                    # Split by newlines
                    for line in raw_actions.split('\n'):
                        if line.strip():
                            priority = cls._detect_priority_from_text(line)
                            actions.append(ActionItem(
                                text=line.strip(),
                                priority=priority
                            ))
        
        return actions
    
    @classmethod
    def _parse_priority(cls, priority_str: str) -> ActionPriority:
        """Parse priority from string."""
        priority_lower = priority_str.lower()
        
        for priority, keywords in cls.PRIORITY_KEYWORDS.items():
            if any(keyword in priority_lower for keyword in keywords):
                return priority
        
        return ActionPriority.MEDIUM
    
    @classmethod
    def _detect_priority_from_text(cls, text: str) -> ActionPriority:
        """Detect priority from action item text."""
        text_lower = text.lower()
        
        for priority, keywords in cls.PRIORITY_KEYWORDS.items():
            if any(keyword in text_lower for keyword in keywords):
                return priority
        
        return ActionPriority.MEDIUM
    
    @classmethod
    def _parse_date(cls, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date from string."""
        if not date_str:
            return None
        
        # Add date parsing logic here
        # For now, return None
        return None
    
    @classmethod
    def _parse_timestamp(cls, timestamp: Optional[Any]) -> datetime:
        """Parse timestamp from various formats."""
        if not timestamp:
            return datetime.now()
        
        # Handle datetime object
        if isinstance(timestamp, datetime):
            return timestamp
        
        # Handle ISO format string
        if isinstance(timestamp, str):
            try:
                return datetime.fromisoformat(timestamp)
            except ValueError:
                # Try other formats
                pass
        
        # Handle Unix timestamp
        if isinstance(timestamp, (int, float)):
            try:
                return datetime.fromtimestamp(timestamp)
            except (ValueError, OSError):
                pass
        
        # Default to now
        return datetime.now()
    
    @classmethod
    def _build_attribution(
        cls,
        enrichment_result: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Attribution:
        """Build attribution information."""
        prompt_info = metadata.get("prompt_info", {})
        
        return Attribution(
            prompt_name=prompt_info.get("name") or "unknown",
            prompt_version=str(prompt_info.get("version", "1.0")),
            prompt_source=prompt_info.get("source", "yaml"),
            analyzer_name=metadata.get("analyzer", "default"),
            analyzer_version=str(metadata.get("analyzer_version", "1.0")),
            model_used=metadata.get("model", "gpt-4"),
            processing_timestamp=cls._parse_timestamp(metadata.get("timestamp"))
        )
    
    @classmethod
    def _build_processing_metrics(cls, metadata: Dict[str, Any]) -> ProcessingMetrics:
        """Build processing metrics."""
        # Parse processing time
        processing_time = metadata.get("processing_time", 0.0)
        if isinstance(processing_time, str):
            # Handle formats like "5s" or "5.2"
            processing_time = processing_time.rstrip('s')
            try:
                processing_time = float(processing_time)
            except ValueError:
                processing_time = 0.0
        
        # Parse tokens used
        tokens_used = metadata.get("tokens_used", 0)
        if isinstance(tokens_used, str):
            # Handle formats like "1,500"
            tokens_used = tokens_used.replace(',', '')
            try:
                tokens_used = int(tokens_used)
            except ValueError:
                tokens_used = 0
        
        # Parse cost
        cost = metadata.get("cost", 0.0)
        if isinstance(cost, str):
            # Handle formats like "$0.045"
            cost = cost.lstrip('$')
            try:
                cost = float(cost)
            except ValueError:
                cost = 0.0
        
        # Parse quality score
        quality_score = metadata.get("quality_score", 0.5)
        if isinstance(quality_score, str):
            try:
                quality_score = float(quality_score)
            except ValueError:
                quality_score = 0.5
        
        # Parse confidence score
        confidence_score = metadata.get("confidence_score", 0.5)
        if isinstance(confidence_score, (int, str)):
            try:
                confidence_score = float(confidence_score)
                # Handle percentage values
                if confidence_score > 1:
                    confidence_score = confidence_score / 100
            except ValueError:
                confidence_score = 0.5
        
        return ProcessingMetrics(
            processing_time_seconds=processing_time,
            tokens_used=tokens_used,
            estimated_cost=cost,
            quality_score=quality_score,
            confidence_score=confidence_score,
            cache_hit=metadata.get("cache_hit", False),
            error_count=metadata.get("error_count", 0)
        )
    
    @classmethod
    def _collect_raw_sections(cls, content_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Collect all sections not already processed into raw_sections."""
        # Skip sections we've already processed
        processed_sections = set()
        for section_list in cls.SECTION_MAPPINGS.values():
            processed_sections.update(section_list)
        
        raw_sections = {}
        for key, value in content_analysis.items():
            if key not in processed_sections:
                raw_sections[key] = value
        
        return raw_sections
    
    @classmethod
    def _create_error_content(
        cls,
        enrichment_result: Dict[str, Any],
        source_metadata: Dict[str, Any],
        error_message: str
    ) -> EnrichedContent:
        """Create a minimal EnrichedContent for error cases."""
        return EnrichedContent(
            content_type="error",
            source_id=source_metadata.get("id", "unknown"),
            source_title=source_metadata.get("title", "Error"),
            quality_score=0.0,
            quality_level=ContentQuality.LOW,
            executive_summary=[f"Error processing content: {error_message}"],
            key_insights=[],
            action_items=[],
            raw_sections={"error": error_message, "raw_result": enrichment_result},
            attribution=Attribution(
                prompt_name="error",
                prompt_version="1.0",
                prompt_source="system",
                analyzer_name="error",
                analyzer_version="1.0",
                model_used="none",
                processing_timestamp=datetime.now()
            ),
            processing_metrics=ProcessingMetrics(
                processing_time_seconds=0.0,
                tokens_used=0,
                estimated_cost=0.0,
                quality_score=0.0,
                confidence_score=0.0,
                error_count=1
            )
        )