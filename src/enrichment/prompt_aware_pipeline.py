"""
Prompt-aware pipeline with full attribution and traceability.
"""
import os
import time
import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field

from ..core.config import PipelineConfig
from ..core.models import SourceContent, EnrichmentResult, ContentStatus
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from ..utils.notion_formatter import NotionFormatter
from .prompt_attribution_tracker import PromptAttributionTracker
from .executive_dashboard_generator import ExecutiveDashboardGenerator
from .pipeline_processor import PipelineProcessor


@dataclass
class PromptMetadata:
    """Metadata for a prompt including version, quality, and performance."""
    prompt_id: str
    prompt_name: str
    version: str
    quality_score: float = 0.0
    user_ratings: List[int] = field(default_factory=list)
    total_uses: int = 0
    last_updated: datetime = field(default_factory=datetime.now)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    

@dataclass
class AttributedResult:
    """Result with full prompt attribution."""
    content: str
    prompt_used: PromptMetadata
    quality_score: float
    processing_time: float
    web_sources: List[Dict] = field(default_factory=list)
    confidence: float = 0.0
    

class PromptAwarePipeline(PipelineProcessor):
    """Enhanced pipeline with prompt attribution and traceability."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize with attribution tracking."""
        super().__init__(config, notion_client)
        
        # Initialize attribution tracker
        self.attribution_tracker = PromptAttributionTracker(notion_client)
        
        # Initialize executive dashboard generator
        self.dashboard_generator = ExecutiveDashboardGenerator()
        
        # Initialize prompt metadata store
        self.prompt_metadata_store = {}
        self._load_prompt_metadata()
        
        # Feature flags
        self.enable_attribution = os.getenv('ENABLE_PROMPT_ATTRIBUTION', 'true').lower() == 'true'
        self.enable_executive_dashboard = os.getenv('ENABLE_EXECUTIVE_DASHBOARD', 'true').lower() == 'true'
        self.enable_feedback_collection = os.getenv('ENABLE_FEEDBACK_COLLECTION', 'true').lower() == 'true'
        
        self.logger.info(f"Prompt-aware pipeline initialized (attribution: {self.enable_attribution})")
        
    def _load_prompt_metadata(self):
        """Load prompt metadata from configuration."""
        # In production, this would load from a database
        # For now, we'll create sample metadata
        self.prompt_metadata_store = {
            "summarizer_v2.1": PromptMetadata(
                prompt_id="sum_001",
                prompt_name="Advanced Executive Summarizer",
                version="2.1",
                quality_score=4.2,
                user_ratings=[4, 5, 4, 4, 3, 5],
                total_uses=1523,
                performance_metrics={
                    "avg_processing_time": 3.2,
                    "success_rate": 0.98,
                    "user_satisfaction": 0.84
                }
            ),
            "insights_v1.5": PromptMetadata(
                prompt_id="ins_001", 
                prompt_name="Strategic Insights Generator",
                version="1.5",
                quality_score=4.7,
                user_ratings=[5, 5, 4, 5, 5],
                total_uses=892,
                performance_metrics={
                    "avg_processing_time": 4.1,
                    "success_rate": 0.95,
                    "user_satisfaction": 0.92
                }
            ),
            "classifier_v3.0": PromptMetadata(
                prompt_id="cls_001",
                prompt_name="Market Intelligence Classifier", 
                version="3.0",
                quality_score=3.8,
                user_ratings=[4, 3, 4, 4, 3],
                total_uses=2104,
                performance_metrics={
                    "avg_processing_time": 1.8,
                    "success_rate": 0.99,
                    "accuracy": 0.87
                }
            ),
            "tagger_v1.2": PromptMetadata(
                prompt_id="tag_001",
                prompt_name="Intelligent Content Tagger",
                version="1.2", 
                quality_score=4.0,
                user_ratings=[4, 4, 4, 5, 3],
                total_uses=445,
                performance_metrics={
                    "avg_processing_time": 2.2,
                    "success_rate": 0.96,
                    "precision": 0.89
                }
            )
        }
        
    def process_with_attribution(self, document: SourceContent) -> Dict[str, Any]:
        """Process document with full prompt attribution tracking."""
        start_time = time.time()
        
        # Extract content
        content = self._extract_content_from_source(document)
        if not content:
            return {"error": "No content extracted"}
            
        # Classify content with attribution
        classification_result = self._classify_with_attribution(content, document.title)
        
        # Run analyzers with prompt metadata
        analysis_results = []
        
        # Summary with attribution
        summary_result = self._analyze_with_attribution(
            content=content,
            title=document.title,
            content_type=classification_result.content,
            analyzer_type="summarizer",
            prompt_key="summarizer_v2.1"
        )
        analysis_results.append(summary_result)
        
        # Insights with attribution  
        insights_result = self._analyze_with_attribution(
            content=content,
            title=document.title,
            content_type=classification_result.content,
            analyzer_type="insights", 
            prompt_key="insights_v1.5"
        )
        analysis_results.append(insights_result)
        
        # Tags with attribution
        if self.content_tagger:
            tags_result = self._analyze_with_attribution(
                content=content,
                title=document.title,
                content_type=classification_result.content,
                analyzer_type="tagger",
                prompt_key="tagger_v1.2"
            )
            analysis_results.append(tags_result)
            
        # Create executive dashboard if enabled
        dashboard = None
        if self.enable_executive_dashboard:
            dashboard = self.dashboard_generator.create_dashboard(
                classification=classification_result,
                analysis_results=analysis_results,
                processing_time=time.time() - start_time
            )
            
        # Format for Notion with attribution
        notion_page = self._create_attributed_notion_page(
            dashboard=dashboard,
            classification=classification_result,
            analysis_results=analysis_results,
            original_content=content,
            document=document
        )
        
        # Store attribution data
        if self.enable_attribution:
            self.attribution_tracker.store_attribution(
                document_id=document.id,
                analysis_results=analysis_results,
                processing_time=time.time() - start_time
            )
            
        return {
            "success": True,
            "notion_page": notion_page,
            "dashboard": dashboard,
            "attribution": analysis_results,
            "processing_time": time.time() - start_time
        }
        
    def _extract_content_from_source(self, document: SourceContent) -> Optional[str]:
        """Extract content from source document."""
        # Use existing extraction logic
        if hasattr(document, 'drive_url') and document.drive_url:
            return self._extract_drive_content(document.drive_url)
        elif hasattr(document, 'article_url') and document.article_url:
            return self._extract_web_content(document.article_url)
        elif hasattr(document, 'content'):
            return document.content
        else:
            return None
            
    def _classify_with_attribution(self, content: str, title: str) -> AttributedResult:
        """Classify content with attribution tracking."""
        start_time = time.time()
        
        # Run classification
        classification = self.classifier.classify_content(content, title)
        
        # Get prompt metadata
        prompt_metadata = self.prompt_metadata_store.get("classifier_v3.0")
        
        # Create attributed result
        result = AttributedResult(
            content=classification.get("content_type", "Other"),
            prompt_used=prompt_metadata,
            quality_score=classification.get("confidence", 0.7),
            processing_time=time.time() - start_time,
            confidence=classification.get("confidence", 0.7)
        )
        
        # Track usage
        if prompt_metadata:
            prompt_metadata.total_uses += 1
            
        return result
        
    def _analyze_with_attribution(
        self,
        content: str,
        title: str,
        content_type: str,
        analyzer_type: str,
        prompt_key: str
    ) -> AttributedResult:
        """Run analyzer with attribution tracking."""
        start_time = time.time()
        
        # Get prompt metadata
        prompt_metadata = self.prompt_metadata_store.get(prompt_key)
        if not prompt_metadata:
            self.logger.warning(f"No metadata found for prompt {prompt_key}")
            prompt_metadata = PromptMetadata(
                prompt_id="unknown",
                prompt_name=f"Unknown {analyzer_type}",
                version="0.0"
            )
            
        # Run appropriate analyzer
        if analyzer_type == "summarizer":
            if self.enhanced_summarizer:
                result = self.enhanced_summarizer.analyze(content, title, content_type)
                analysis_content = result.get("analysis", "") if result.get("success") else ""
                web_sources = result.get("web_citations", [])
            else:
                analysis_content = self.summarizer.generate_summary(content, title)
                web_sources = []
                
        elif analyzer_type == "insights":
            if self.enhanced_insights:
                result = self.enhanced_insights.analyze(content, title, content_type) 
                analysis_content = result.get("analysis", "") if result.get("success") else ""
                web_sources = result.get("web_citations", [])
            else:
                insights = self.insights_generator.generate_insights(content, title)
                analysis_content = "\n".join(f"• {insight}" for insight in insights)
                web_sources = []
                
        elif analyzer_type == "tagger":
            result = self.content_tagger.analyze(content, title, content_type)
            if result.get("success"):
                analysis_content = {
                    "topical_tags": result.get("topical_tags", []),
                    "domain_tags": result.get("domain_tags", [])
                }
            else:
                analysis_content = {"topical_tags": [], "domain_tags": []}
            web_sources = []
            
        else:
            analysis_content = ""
            web_sources = []
            
        # Create attributed result
        attributed_result = AttributedResult(
            content=analysis_content,
            prompt_used=prompt_metadata,
            quality_score=self._calculate_analysis_quality(analysis_content),
            processing_time=time.time() - start_time,
            web_sources=web_sources
        )
        
        # Track usage
        prompt_metadata.total_uses += 1
        
        return attributed_result
        
    def _calculate_analysis_quality(self, content: Any) -> float:
        """Calculate quality score for analysis."""
        if isinstance(content, str):
            # For text content, check length and structure
            if len(content) > 500:
                return 0.9
            elif len(content) > 200:
                return 0.7
            else:
                return 0.5
        elif isinstance(content, dict):
            # For structured content like tags
            total_items = len(content.get("topical_tags", [])) + len(content.get("domain_tags", []))
            if total_items >= 5:
                return 0.9
            elif total_items >= 3:
                return 0.7
            else:
                return 0.5
        else:
            return 0.5
            
    def _create_attributed_notion_page(
        self,
        dashboard: Optional[Dict],
        classification: AttributedResult,
        analysis_results: List[AttributedResult],
        original_content: str,
        document: SourceContent
    ) -> Dict[str, Any]:
        """Create Notion page with full attribution."""
        blocks = []
        
        # Executive Dashboard (if enabled)
        if dashboard and self.enable_executive_dashboard:
            dashboard_blocks = self._create_dashboard_blocks(dashboard)
            blocks.extend(dashboard_blocks)
            blocks.append({"type": "divider", "divider": {}})
            
        # AI Analysis Sections with Attribution
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "🧠 AI Analysis"}}]
            }
        })
        
        # Add each analysis with attribution
        for result in analysis_results:
            if result.prompt_used:
                attribution_blocks = self._create_attribution_blocks(result)
                blocks.extend(attribution_blocks)
                
        # Prompt Performance Section
        if self.enable_attribution:
            performance_blocks = self._create_performance_blocks(analysis_results)
            blocks.extend(performance_blocks)
            
        # Original Content (collapsible)
        blocks.append({"type": "divider", "divider": {}})
        blocks.append({
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📄 Original Content"}}],
                "children": self._chunk_text_to_blocks(original_content)
            }
        })
        
        return {
            "properties": self._create_page_properties(classification, analysis_results),
            "children": blocks
        }
        
    def _create_dashboard_blocks(self, dashboard: Dict) -> List[Dict]:
        """Create Notion blocks for executive dashboard."""
        blocks = []
        
        # Dashboard Header
        blocks.append({
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"type": "text", "text": {"content": "📊 Executive Dashboard"}}]
            }
        })
        
        # Key Metrics Cards
        if "key_metrics" in dashboard:
            blocks.append({
                "type": "callout",
                "callout": {
                    "rich_text": self._format_metrics_cards(dashboard["key_metrics"]),
                    "icon": {"emoji": "📈"}
                }
            })
            
        # Priority Actions
        if "priority_actions" in dashboard:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "🎯 Priority Actions"}}]
                }
            })
            for action in dashboard["priority_actions"]:
                blocks.append({
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [{"type": "text", "text": {"content": action}}],
                        "checked": False
                    }
                })
                
        # Risk/Opportunity Matrix
        if "risk_matrix" in dashboard:
            blocks.append({
                "type": "heading_3", 
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "⚖️ Risk/Opportunity Matrix"}}]
                }
            })
            blocks.append({
                "type": "table",
                "table": self._create_risk_matrix_table(dashboard["risk_matrix"])
            })
            
        return blocks
        
    def _create_attribution_blocks(self, result: AttributedResult) -> List[Dict]:
        """Create blocks showing analysis with attribution."""
        blocks = []
        prompt = result.prompt_used
        
        # Create header with prompt info and quality stars
        quality_stars = "⭐" * int(prompt.quality_score) if prompt.quality_score > 0 else ""
        header = f"{prompt.prompt_name} v{prompt.version} {quality_stars}"
        
        # Analysis content block
        blocks.append({
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": header}}],
                "children": self._format_analysis_content(result)
            }
        })
        
        return blocks
        
    def _create_performance_blocks(self, analysis_results: List[AttributedResult]) -> List[Dict]:
        """Create prompt performance tracking blocks."""
        blocks = []
        
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📈 Prompt Performance"}}]
            }
        })
        
        # Performance table
        performance_data = []
        for result in analysis_results:
            if result.prompt_used:
                prompt = result.prompt_used
                performance_data.append({
                    "prompt": prompt.prompt_name,
                    "version": prompt.version,
                    "quality": f"{prompt.quality_score:.1f}/5.0",
                    "uses": str(prompt.total_uses),
                    "time": f"{result.processing_time:.2f}s"
                })
                
        if performance_data:
            blocks.extend(self._create_performance_table(performance_data))
            
        # Feedback section if enabled
        if self.enable_feedback_collection:
            blocks.append({
                "type": "callout",
                "callout": {
                    "rich_text": [{"type": "text", "text": {"content": "Rate the quality of these AI analyses:"}}],
                    "icon": {"emoji": "💭"}
                }
            })
            
        return blocks
        
    def _format_metrics_cards(self, metrics: Dict) -> List[Dict]:
        """Format key metrics as rich text."""
        text_parts = []
        for key, value in metrics.items():
            text_parts.append({
                "type": "text",
                "text": {"content": f"{key}: "},
                "annotations": {"bold": True}
            })
            text_parts.append({
                "type": "text", 
                "text": {"content": f"{value}\n"}
            })
        return text_parts
        
    def _create_risk_matrix_table(self, matrix: Dict) -> Dict:
        """Create a table for risk/opportunity matrix."""
        # Simplified table structure
        return {
            "table_width": 3,
            "has_column_header": True,
            "children": [
                # Header row
                {
                    "type": "table_row",
                    "table_row": {
                        "cells": [
                            [{"type": "text", "text": {"content": "Category"}}],
                            [{"type": "text", "text": {"content": "Risk Level"}}],
                            [{"type": "text", "text": {"content": "Opportunity"}}]
                        ]
                    }
                }
                # Data rows would be added here
            ]
        }
        
    def _format_analysis_content(self, result: AttributedResult) -> List[Dict]:
        """Format analysis content with web citations."""
        blocks = []
        
        # Main content
        if isinstance(result.content, str):
            blocks.extend(self._markdown_to_blocks(result.content))
        elif isinstance(result.content, dict):
            # For structured content like tags
            formatted = json.dumps(result.content, indent=2)
            blocks.extend(self._markdown_to_blocks(formatted))
            
        # Web citations if present
        if result.web_sources:
            citation_text = self._format_web_citations(result.web_sources)
            blocks.extend(self._markdown_to_blocks(citation_text))
            
        # Attribution metadata
        metadata = f"\n---\n📊 Quality Score: {result.quality_score:.2f} | ⏱️ Processing: {result.processing_time:.2f}s"
        blocks.extend(self._markdown_to_blocks(metadata))
        
        return blocks
        
    def _create_performance_table(self, data: List[Dict]) -> List[Dict]:
        """Create a simple performance table."""
        blocks = []
        
        # Table header
        header = "| Prompt | Version | Quality | Total Uses | Processing Time |"
        separator = "|--------|---------|---------|------------|-----------------|"
        
        blocks.append(self._create_paragraph_block(header))
        blocks.append(self._create_paragraph_block(separator))
        
        # Table rows
        for row in data:
            row_text = f"| {row['prompt']} | {row['version']} | {row['quality']} | {row['uses']} | {row['time']} |"
            blocks.append(self._create_paragraph_block(row_text))
            
        return blocks
        
    def _create_page_properties(self, classification: AttributedResult, analysis_results: List[AttributedResult]) -> Dict:
        """Create Notion page properties with attribution data."""
        properties = {
            "Status": {"select": {"name": "Enriched"}},
            "Content-Type": {"select": {"name": classification.content}}
        }
        
        # Add prompt quality indicator
        avg_quality = sum(r.quality_score for r in analysis_results if r.prompt_used) / len(analysis_results)
        if avg_quality >= 0.8:
            properties["Quality"] = {"select": {"name": "High"}}
        elif avg_quality >= 0.6:
            properties["Quality"] = {"select": {"name": "Medium"}}
        else:
            properties["Quality"] = {"select": {"name": "Low"}}
            
        return properties