"""
Prompt-Aware Content Assembly System for Notion Pages
====================================================

This module implements a completely new architecture that provides full traceability
between prompts and generated content, enabling continuous improvement through
feedback loops and A/B testing.

Architecture Overview:
- Every piece of content is traceable to its generating prompt
- Prompts are versioned and stored in Notion with performance metrics
- Content blocks include inline metadata about prompt performance
- Feedback loops enable continuous prompt improvement
- Cross-prompt intelligence detects relationships between outputs
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from uuid import uuid4
from collections import defaultdict
from ..core.config import PipelineConfig
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from notion_client import Client


@dataclass
class Citation:
    """Represents a citation from web search or other sources."""
    title: str
    url: str
    domain: str
    relevance_score: float = 1.0
    
    
@dataclass 
class TrackedAnalyzerResult:
    """Enhanced analyzer result with full prompt traceability."""
    # Core content
    content: str
    content_type: str
    analyzer_type: str
    
    # Prompt tracking
    prompt_id: str
    prompt_name: str
    prompt_version: str
    prompt_page_url: str
    
    # Quality metrics
    quality_score: float
    confidence_score: float
    coherence_score: float
    actionability_score: float
    
    # Generation metadata
    generation_timestamp: datetime
    temperature_used: float
    model_used: str
    token_count: int
    generation_time_ms: int
    
    # Enhanced features
    web_search_enabled: bool
    citations: List[Citation] = field(default_factory=list)
    cross_references: List[str] = field(default_factory=list)  # IDs of related results
    
    # Structured content elements
    key_points: List[str] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    entities_mentioned: List[str] = field(default_factory=list)
    topics_covered: List[str] = field(default_factory=list)
    
    
@dataclass
class PromptPerformanceMetrics:
    """Tracks performance metrics for a specific prompt."""
    prompt_id: str
    total_uses: int = 0
    total_quality_score: float = 0.0
    total_user_ratings: float = 0.0
    rating_count: int = 0
    
    # Detailed metrics
    coherence_scores: List[float] = field(default_factory=list)
    actionability_scores: List[float] = field(default_factory=list)
    generation_times: List[int] = field(default_factory=list)
    token_usage: List[int] = field(default_factory=list)
    
    # A/B testing data
    ab_test_group: Optional[str] = None
    conversion_rate: float = 0.0  # How often users act on the content
    
    @property
    def average_quality(self) -> float:
        """Calculate average quality score."""
        return self.total_quality_score / self.total_uses if self.total_uses > 0 else 0.0
    
    @property
    def average_rating(self) -> float:
        """Calculate average user rating."""
        return self.total_user_ratings / self.rating_count if self.rating_count > 0 else 0.0
    

class PromptAwareEnrichmentPipeline:
    """Orchestrates prompt-aware content enrichment with full traceability."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize the prompt-aware pipeline."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Initialize Notion client for prompt management
        self.prompt_db_id = os.getenv("NOTION_PROMPTS_DB_ID")
        self.analytics_db_id = os.getenv("NOTION_PROMPT_ANALYTICS_DB_ID")
        
        # Performance tracking
        self.prompt_metrics: Dict[str, PromptPerformanceMetrics] = {}
        self.session_results: List[TrackedAnalyzerResult] = []
        
        # Cross-prompt intelligence
        self.entity_index: Dict[str, Set[str]] = defaultdict(set)  # entity -> result_ids
        self.topic_index: Dict[str, Set[str]] = defaultdict(set)   # topic -> result_ids
        self.action_consolidator = ActionItemConsolidator()
        
        # A/B testing configuration
        self.ab_tests: Dict[str, Dict[str, Any]] = {}  # test_id -> test_config
        self.active_tests: Set[str] = set()
        
    def enrich_content(self, content: str, page_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform prompt-aware enrichment with full tracking.
        
        Args:
            content: The text content to analyze
            page_id: Notion page ID
            metadata: Additional metadata (title, content_type, etc.)
            
        Returns:
            Enrichment results with prompt attribution
        """
        start_time = time.time()
        results = []
        
        # Determine content type
        content_type = metadata.get("content_type", "general")
        title = metadata.get("title", "Untitled")
        
        # Get all applicable prompts for this content type
        prompts = self._get_prompts_for_content_type(content_type)
        
        # Run each analyzer with its tracked prompt
        for prompt_config in prompts:
            try:
                # Check if this prompt is part of an A/B test
                test_group = self._get_ab_test_group(prompt_config["id"])
                if test_group and not self._should_use_variant(test_group):
                    continue
                    
                result = self._run_tracked_analyzer(
                    content=content,
                    title=title,
                    prompt_config=prompt_config,
                    content_type=content_type
                )
                
                # Store result
                results.append(result)
                self.session_results.append(result)
                
                # Update indices for cross-referencing
                self._update_intelligence_indices(result)
                
                # Update performance metrics
                self._update_prompt_metrics(result)
                
            except Exception as e:
                self.logger.error(f"Failed to run analyzer {prompt_config.get('analyzer_type')}: {e}")
        
        # Perform cross-prompt intelligence analysis
        cross_insights = self._analyze_cross_prompt_intelligence(results)
        
        # Generate enhanced Notion blocks
        blocks = self._generate_prompt_aware_blocks(results, cross_insights)
        
        # Store feedback hooks for continuous improvement
        self._create_feedback_mechanisms(page_id, results)
        
        total_time = int((time.time() - start_time) * 1000)
        
        return {
            "blocks": blocks,
            "results": results,
            "cross_insights": cross_insights,
            "total_time_ms": total_time,
            "prompts_used": len(results)
        }
    
    def _get_prompts_for_content_type(self, content_type: str) -> List[Dict[str, Any]]:
        """Fetch all active prompts for a given content type from Notion."""
        if not self.prompt_db_id:
            return self._get_default_prompts()
            
        try:
            # Query Notion prompts database
            response = self.notion_client.client.databases.query(
                database_id=self.prompt_db_id,
                filter={
                    "and": [
                        {"property": "Active", "checkbox": {"equals": True}},
                        {"property": "Content Type", "select": {"equals": content_type}}
                    ]
                },
                sorts=[
                    {"property": "Priority", "direction": "ascending"},
                    {"property": "Version", "direction": "descending"}
                ]
            )
            
            prompts = []
            seen_types = set()
            
            for page in response.get("results", []):
                props = page["properties"]
                analyzer_type = self._get_property_value(props.get("Analyzer Type"))
                
                # Only use highest version of each analyzer type
                if analyzer_type in seen_types:
                    continue
                seen_types.add(analyzer_type)
                
                prompt_config = {
                    "id": page["id"],
                    "name": self._get_property_value(props.get("Name")),
                    "analyzer_type": analyzer_type,
                    "system_prompt": self._get_property_value(props.get("System Prompt")),
                    "user_prompt_template": self._get_property_value(props.get("User Prompt Template")),
                    "version": self._get_property_value(props.get("Version"), 1.0),
                    "temperature": self._get_property_value(props.get("Temperature"), 0.3),
                    "web_search": self._get_property_value(props.get("Web Search"), False),
                    "quality_threshold": self._get_property_value(props.get("Quality Threshold"), 0.7),
                    "page_url": f"https://notion.so/{page['id'].replace('-', '')}"
                }
                
                prompts.append(prompt_config)
            
            return prompts
            
        except Exception as e:
            self.logger.error(f"Failed to fetch prompts from Notion: {e}")
            return self._get_default_prompts()
    
    def _run_tracked_analyzer(self, content: str, title: str, 
                            prompt_config: Dict[str, Any], content_type: str) -> TrackedAnalyzerResult:
        """Run an analyzer with full prompt tracking."""
        start_time = time.time()
        
        # Generate unique result ID
        result_id = str(uuid4())
        
        # Create the analyzer instance based on type
        analyzer = self._create_analyzer_instance(prompt_config["analyzer_type"])
        
        # Prepare prompts
        system_prompt = prompt_config["system_prompt"]
        user_prompt = self._format_user_prompt(
            prompt_config["user_prompt_template"],
            content=content,
            title=title,
            content_type=content_type
        )
        
        # Run analysis
        try:
            if prompt_config["web_search"] and hasattr(analyzer, "analyze_with_web_search"):
                raw_result = analyzer.analyze_with_web_search(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=prompt_config["temperature"]
                )
            else:
                raw_result = analyzer.analyze(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=prompt_config["temperature"]
                )
            
            # Parse and structure the result
            structured_result = self._parse_analyzer_output(raw_result, prompt_config["analyzer_type"])
            
            # Calculate quality scores
            quality_scores = self._calculate_quality_scores(structured_result, content)
            
            # Extract entities and topics
            entities = self._extract_entities(structured_result["content"])
            topics = self._extract_topics(structured_result["content"])
            
            # Create tracked result
            result = TrackedAnalyzerResult(
                content=structured_result["content"],
                content_type=content_type,
                analyzer_type=prompt_config["analyzer_type"],
                prompt_id=prompt_config["id"],
                prompt_name=prompt_config["name"],
                prompt_version=str(prompt_config["version"]),
                prompt_page_url=prompt_config["page_url"],
                quality_score=quality_scores["overall"],
                confidence_score=quality_scores["confidence"],
                coherence_score=quality_scores["coherence"],
                actionability_score=quality_scores["actionability"],
                generation_timestamp=datetime.now(),
                temperature_used=prompt_config["temperature"],
                model_used=raw_result.get("model", "gpt-4"),
                token_count=raw_result.get("token_count", 0),
                generation_time_ms=int((time.time() - start_time) * 1000),
                web_search_enabled=prompt_config["web_search"],
                citations=structured_result.get("citations", []),
                key_points=structured_result.get("key_points", []),
                action_items=structured_result.get("action_items", []),
                entities_mentioned=entities,
                topics_covered=topics
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Analyzer {prompt_config['analyzer_type']} failed: {e}")
            # Return a minimal result on failure
            return TrackedAnalyzerResult(
                content=f"Analysis failed: {str(e)}",
                content_type=content_type,
                analyzer_type=prompt_config["analyzer_type"],
                prompt_id=prompt_config["id"],
                prompt_name=prompt_config["name"],
                prompt_version=str(prompt_config["version"]),
                prompt_page_url=prompt_config["page_url"],
                quality_score=0.0,
                confidence_score=0.0,
                coherence_score=0.0,
                actionability_score=0.0,
                generation_timestamp=datetime.now(),
                temperature_used=prompt_config["temperature"],
                model_used="unknown",
                token_count=0,
                generation_time_ms=int((time.time() - start_time) * 1000),
                web_search_enabled=False
            )
    
    def _analyze_cross_prompt_intelligence(self, results: List[TrackedAnalyzerResult]) -> Dict[str, Any]:
        """Analyze relationships and patterns across different prompt outputs."""
        cross_insights = {
            "common_entities": self._find_common_entities(results),
            "topic_clusters": self._cluster_topics(results),
            "consolidated_actions": self.action_consolidator.consolidate(results),
            "quality_comparison": self._compare_prompt_quality(results),
            "citation_overlap": self._analyze_citation_overlap(results),
            "complementary_insights": self._find_complementary_insights(results)
        }
        
        return cross_insights
    
    def _generate_prompt_aware_blocks(self, results: List[TrackedAnalyzerResult], 
                                    cross_insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate Notion blocks with prompt attribution and metadata."""
        blocks = []
        
        # Add header with overview
        blocks.append(self._create_header_block(
            "🧠 AI-Enriched Analysis", 
            f"Generated by {len(results)} specialized AI prompts"
        ))
        
        # Add quality summary callout
        avg_quality = sum(r.quality_score for r in results) / len(results) if results else 0
        blocks.append(self._create_quality_callout(avg_quality, results))
        
        # Add cross-prompt insights section
        if cross_insights["consolidated_actions"]:
            blocks.extend(self._create_consolidated_actions_section(cross_insights["consolidated_actions"]))
        
        # Add individual analyzer results with attribution
        for result in results:
            blocks.extend(self._create_analyzer_section(result))
        
        # Add relationships section
        if cross_insights["complementary_insights"]:
            blocks.extend(self._create_relationships_section(cross_insights))
        
        # Add feedback section
        blocks.extend(self._create_feedback_section(results))
        
        return blocks
    
    def _create_analyzer_section(self, result: TrackedAnalyzerResult) -> List[Dict[str, Any]]:
        """Create Notion blocks for a single analyzer result with full attribution."""
        blocks = []
        
        # Section header with prompt attribution
        header_text = f"{self._get_analyzer_emoji(result.analyzer_type)} {result.analyzer_type.title()}"
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": header_text}}]
            }
        })
        
        # Prompt metadata callout
        metadata_text = (
            f"**Prompt**: [{result.prompt_name}]({result.prompt_page_url})\n"
            f"**Version**: {result.prompt_version} | "
            f"**Quality**: {result.quality_score:.0%} | "
            f"**Confidence**: {result.confidence_score:.0%}\n"
            f"**Model**: {result.model_used} | "
            f"**Temperature**: {result.temperature_used}"
        )
        
        if result.web_search_enabled and result.citations:
            metadata_text += f"\n**Sources**: {len(result.citations)} web sources consulted"
        
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": self._parse_markdown_to_rich_text(metadata_text),
                "icon": {"type": "emoji", "emoji": "🔖"},
                "color": "gray_background"
            }
        })
        
        # Main content
        content_blocks = self._format_analyzer_content(result)
        blocks.extend(content_blocks)
        
        # Citations if available
        if result.citations:
            blocks.extend(self._create_citation_blocks(result.citations))
        
        # Performance metrics toggle
        blocks.append(self._create_performance_toggle(result))
        
        return blocks
    
    def _create_feedback_section(self, results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Create feedback collection blocks."""
        blocks = []
        
        blocks.append({
            "type": "heading_3",
            "heading_3": {
                "rich_text": [{"type": "text", "text": {"content": "📊 Rate This Analysis"}}]
            }
        })
        
        # Create a table for ratings
        table_rows = []
        
        # Header row
        table_rows.append({
            "type": "table_row",
            "table_row": {
                "cells": [
                    [{"type": "text", "text": {"content": "Analyzer"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Quality"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Usefulness"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Actions"}, "annotations": {"bold": True}}]
                ]
            }
        })
        
        # Rating rows for each analyzer
        for result in results:
            table_rows.append({
                "type": "table_row",
                "table_row": {
                    "cells": [
                        [{"type": "text", "text": {"content": result.analyzer_type.title()}}],
                        [{"type": "text", "text": {"content": "⭐⭐⭐⭐⭐"}}],  # Placeholder for rating widget
                        [{"type": "text", "text": {"content": "[ ] Very useful"}}],
                        [{"type": "text", "text": {"content": f"[Rate Prompt]({result.prompt_page_url})"}}]
                    ]
                }
            })
        
        blocks.append({
            "type": "table",
            "table": {
                "table_width": 4,
                "has_column_header": True,
                "children": table_rows
            }
        })
        
        return blocks
    
    def _update_prompt_metrics(self, result: TrackedAnalyzerResult) -> None:
        """Update performance metrics for a prompt."""
        prompt_id = result.prompt_id
        
        if prompt_id not in self.prompt_metrics:
            self.prompt_metrics[prompt_id] = PromptPerformanceMetrics(prompt_id=prompt_id)
        
        metrics = self.prompt_metrics[prompt_id]
        metrics.total_uses += 1
        metrics.total_quality_score += result.quality_score
        metrics.coherence_scores.append(result.coherence_score)
        metrics.actionability_scores.append(result.actionability_score)
        metrics.generation_times.append(result.generation_time_ms)
        metrics.token_usage.append(result.token_count)
        
        # Persist to Notion analytics database if configured
        if self.analytics_db_id:
            self._persist_metrics_to_notion(metrics, result)
    
    def collect_user_feedback(self, page_id: str, result_id: str, 
                            rating: float, usefulness: bool, acted_on: bool) -> None:
        """Collect user feedback for a specific analyzer result."""
        # Find the result
        result = next((r for r in self.session_results if r.prompt_id == result_id), None)
        if not result:
            return
        
        # Update metrics
        if result.prompt_id in self.prompt_metrics:
            metrics = self.prompt_metrics[result.prompt_id]
            metrics.total_user_ratings += rating
            metrics.rating_count += 1
            
            if acted_on:
                metrics.conversion_rate = (
                    (metrics.conversion_rate * (metrics.total_uses - 1) + 1) / metrics.total_uses
                )
        
        # Update prompt quality score in Notion
        self._update_prompt_quality_in_notion(result.prompt_id, rating, usefulness)
        
        # Log for analysis
        self.logger.info(
            f"Feedback collected for {result.analyzer_type}: "
            f"rating={rating}, useful={usefulness}, acted_on={acted_on}"
        )
    
    # Helper methods
    
    def _get_property_value(self, prop: Optional[Dict], default: Any = None) -> Any:
        """Extract value from Notion property."""
        if not prop:
            return default
            
        prop_type = prop.get("type")
        
        if prop_type == "title":
            texts = prop.get("title", [])
            return texts[0].get("plain_text", "") if texts else default
        elif prop_type == "rich_text":
            texts = prop.get("rich_text", [])
            return texts[0].get("plain_text", "") if texts else default
        elif prop_type == "select":
            return prop.get("select", {}).get("name", default)
        elif prop_type == "number":
            return prop.get("number", default)
        elif prop_type == "checkbox":
            return prop.get("checkbox", default)
        else:
            return default
    
    def _get_analyzer_emoji(self, analyzer_type: str) -> str:
        """Get emoji for analyzer type."""
        emoji_map = {
            "summarizer": "📋",
            "insights": "💡",
            "classifier": "🏷️",
            "technical": "🔧",
            "strategic": "🎯",
            "market": "📊",
            "risks": "⚠️"
        }
        return emoji_map.get(analyzer_type.lower(), "🤖")
    
    def _parse_markdown_to_rich_text(self, text: str) -> List[Dict[str, Any]]:
        """Convert markdown to Notion rich text format."""
        # Simple implementation - could be enhanced
        return [{"type": "text", "text": {"content": text}}]
    
    def _get_default_prompts(self) -> List[Dict[str, Any]]:
        """Return default prompts when database is not available."""
        return [
            {
                "id": "default-summarizer",
                "name": "Default Summarizer",
                "analyzer_type": "summarizer",
                "system_prompt": "You are an expert content analyst.",
                "user_prompt_template": "Summarize this {content_type}: {content}",
                "version": "1.0",
                "temperature": 0.3,
                "web_search": False,
                "quality_threshold": 0.7,
                "page_url": "#"
            }
        ]


class ActionItemConsolidator:
    """Consolidates action items across multiple analyzer results."""
    
    def consolidate(self, results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Consolidate and deduplicate action items from multiple sources."""
        all_actions = []
        
        for result in results:
            for action in result.action_items:
                all_actions.append({
                    "text": action,
                    "source": result.analyzer_type,
                    "prompt_id": result.prompt_id,
                    "confidence": result.confidence_score
                })
        
        # Group similar actions
        consolidated = self._group_similar_actions(all_actions)
        
        # Sort by priority (confidence * source_count)
        consolidated.sort(key=lambda x: x["priority"], reverse=True)
        
        return consolidated
    
    def _group_similar_actions(self, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group similar action items together."""
        # Simple implementation - could use embeddings for better matching
        groups = []
        seen = set()
        
        for action in actions:
            if action["text"] in seen:
                continue
                
            similar = [a for a in actions if self._are_similar(action["text"], a["text"])]
            
            if similar:
                group = {
                    "text": action["text"],
                    "sources": list(set(a["source"] for a in similar)),
                    "source_count": len(similar),
                    "avg_confidence": sum(a["confidence"] for a in similar) / len(similar),
                    "priority": len(similar) * (sum(a["confidence"] for a in similar) / len(similar))
                }
                groups.append(group)
                seen.update(a["text"] for a in similar)
        
        return groups
    
    def _are_similar(self, text1: str, text2: str) -> bool:
        """Check if two action items are similar."""
        # Simple word overlap check - could be enhanced
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        overlap = len(words1 & words2)
        total = len(words1 | words2)
        
        return overlap / total > 0.6 if total > 0 else False