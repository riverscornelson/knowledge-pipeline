"""
Integration module for the prompt-aware Notion formatter with the existing pipeline.
Provides seamless transition from the old formatting system to the new one.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from enrichment.pipeline_processor import PipelineProcessor
from core.models import EnrichmentResult
from .prompt_aware_notion_formatter import (
    PromptAwareNotionFormatter, 
    PromptMetadata, 
    TrackedAnalyzerResult
)
from .enhanced_attribution_formatter import EnhancedAttributionFormatter
from utils.logging import setup_logger


class FormatterIntegration:
    """Integrates the new prompt-aware formatter with existing pipeline."""
    
    def __init__(self, pipeline_processor: PipelineProcessor):
        """Initialize integration with pipeline processor."""
        self.pipeline = pipeline_processor
        self.logger = setup_logger(__name__)
        
        # Initialize the new formatter
        self.prompt_formatter = PromptAwareNotionFormatter(
            notion_client=pipeline_processor.notion_client,
            prompt_db_id=pipeline_processor.prompt_config.notion_db_id if hasattr(pipeline_processor.prompt_config, 'notion_db_id') else None
        )
        
        # Initialize enhanced attribution formatter
        self.attribution_formatter = EnhancedAttributionFormatter(
            prompt_config=pipeline_processor.prompt_config
        )
        
        # Track formatting preferences
        self.use_legacy_formatting = False
        self.enable_mobile_optimization = True
        self.enable_cross_insights = True
        self.enable_enhanced_attribution = True
        
    def format_enrichment_result(self, 
                                result: EnrichmentResult, 
                                item: Dict[str, Any],
                                raw_content: str) -> List[Dict[str, Any]]:
        """Format enrichment result using the new prompt-aware system."""
        
        # Convert EnrichmentResult to TrackedAnalyzerResults
        tracked_results = self._convert_to_tracked_results(result, item)
        
        # Track prompt sources
        prompt_sources = self._track_prompt_sources(result, tracked_results)
        
        # Create executive dashboard if multiple analyses
        blocks = []
        
        if len(tracked_results) > 1 and not self.use_legacy_formatting:
            if self.enable_enhanced_attribution:
                # Add enhanced attribution dashboard
                attribution_blocks = self.attribution_formatter.create_attribution_dashboard(
                    tracked_results,
                    result.processing_time,
                    prompt_sources
                )
                blocks.extend(attribution_blocks)
            else:
                # Add standard executive dashboard
                dashboard_blocks = self.prompt_formatter.create_executive_dashboard(tracked_results)
                blocks.extend(dashboard_blocks)
            
            # Add divider
            blocks.append({"type": "divider", "divider": {}})
        
        # Add individual analysis sections
        for tracked_result in tracked_results:
            section_blocks = self.prompt_formatter.create_prompt_attributed_section(tracked_result)
            blocks.extend(section_blocks)
            
            # Add divider between sections
            if tracked_result != tracked_results[-1]:
                blocks.append({"type": "divider", "divider": {}})
        
        # Add cross-insights if enabled
        if self.enable_cross_insights and len(tracked_results) > 1:
            blocks.append({"type": "divider", "divider": {}})
            cross_blocks = self.prompt_formatter.create_insight_connections(tracked_results)
            blocks.extend(cross_blocks)
        
        # Add raw content toggle (from original)
        blocks.append({"type": "divider", "divider": {}})
        blocks.extend(self._create_raw_content_toggle(raw_content))
        
        # Optimize for mobile if enabled
        if self.enable_mobile_optimization:
            blocks = self.prompt_formatter.optimize_for_mobile(blocks)
            
        return blocks
    
    def _convert_to_tracked_results(self, 
                                   result: EnrichmentResult,
                                   item: Dict[str, Any]) -> List[TrackedAnalyzerResult]:
        """Convert EnrichmentResult to TrackedAnalyzerResults with metadata."""
        tracked_results = []
        
        # Create metadata from result
        base_metadata = self._create_base_metadata(result)
        
        # Core Summary
        if result.core_summary:
            summary_metadata = PromptMetadata(
                analyzer_name="Core Summarizer",
                prompt_version=result.prompt_config.get("prompt_version", "2.0") if hasattr(result, "prompt_config") else "2.0",
                content_type=result.content_type,
                temperature=getattr(result, "temperature", 0.3),
                web_search_used=getattr(result, "summary_web_search_used", False),
                quality_score=self._calculate_component_quality(result, "summary"),
                processing_time=result.processing_time / 3,  # Estimate
                token_usage={"total_tokens": result.token_usage.get("total_tokens", 0) // 3},
                citations=getattr(result, "summary_web_citations", []),
                confidence_scores={"overall": result.confidence_scores.get("classification", 0.7)}
            )
            
            tracked_results.append(TrackedAnalyzerResult(
                analyzer_name="Core Summarizer",
                content=result.core_summary,
                metadata=summary_metadata,
                timestamp=datetime.now()
            ))
        
        # Key Insights
        if result.key_insights or hasattr(result, "structured_insights"):
            insights_content = getattr(result, "structured_insights", "\n".join(f"• {insight}" for insight in result.key_insights))
            
            insights_metadata = PromptMetadata(
                analyzer_name="Strategic Insights",
                prompt_version=result.prompt_config.get("prompt_version", "2.0") if hasattr(result, "prompt_config") else "2.0",
                content_type=result.content_type,
                temperature=getattr(result, "temperature", 0.3),
                web_search_used=getattr(result, "insights_web_search_used", False),
                quality_score=self._calculate_component_quality(result, "insights"),
                processing_time=result.processing_time / 3,
                token_usage={"total_tokens": result.token_usage.get("total_tokens", 0) // 3},
                citations=getattr(result, "insights_web_citations", []),
                confidence_scores={"overall": result.confidence_scores.get("classification", 0.7)}
            )
            
            tracked_results.append(TrackedAnalyzerResult(
                analyzer_name="Strategic Insights",
                content=insights_content,
                metadata=insights_metadata,
                timestamp=datetime.now()
            ))
        
        # Classification
        classification_content = self._format_classification_content(result)
        if classification_content:
            class_metadata = PromptMetadata(
                analyzer_name="Content Classifier",
                prompt_version="2.0",
                content_type=result.content_type,
                temperature=0.1,  # Classification uses low temperature
                web_search_used=False,
                quality_score=result.confidence_scores.get("classification", 0.7),
                processing_time=result.processing_time / 3,
                token_usage={"total_tokens": result.token_usage.get("total_tokens", 0) // 3},
                confidence_scores=result.confidence_scores
            )
            
            tracked_results.append(TrackedAnalyzerResult(
                analyzer_name="Content Classifier",
                content=classification_content,
                metadata=class_metadata,
                timestamp=datetime.now()
            ))
        
        # Additional analyses if present
        if hasattr(result, "additional_analyses"):
            for analyzer_name, analysis in result.additional_analyses.items():
                if analysis.get("success"):
                    add_metadata = PromptMetadata(
                        analyzer_name=analyzer_name,
                        prompt_version="2.0",
                        content_type=result.content_type,
                        temperature=analysis.get("temperature", 0.3),
                        web_search_used=analysis.get("web_search_used", False),
                        quality_score=analysis.get("quality_score", 0.7),
                        processing_time=analysis.get("processing_time", result.processing_time / 4),
                        token_usage=analysis.get("token_usage", {"total_tokens": 0}),
                        citations=analysis.get("web_citations", [])
                    )
                    
                    # Create tracked result with prompt source info
                    tracked_result = TrackedAnalyzerResult(
                        analyzer_name=analyzer_name,
                        content=analysis.get("analysis", ""),
                        metadata=add_metadata,
                        timestamp=datetime.now(),
                        raw_response=analysis
                    )
                    
                    # Add prompt source if available
                    if hasattr(analysis, "prompt_source"):
                        tracked_result.prompt_source = analysis.prompt_source
                    
                    tracked_results.append(tracked_result)
        
        return tracked_results
    
    def _create_base_metadata(self, result: EnrichmentResult) -> Dict[str, Any]:
        """Create base metadata from enrichment result."""
        return {
            "content_type": result.content_type,
            "processing_time": result.processing_time,
            "token_usage": result.token_usage,
            "quality_score": getattr(result, "quality_score", 0.7),
            "web_search_enabled": getattr(result, "web_search_used", False)
        }
    
    def _calculate_component_quality(self, result: EnrichmentResult, component: str) -> float:
        """Calculate quality score for a specific component."""
        if component == "summary":
            # Based on length and completeness
            length = len(result.core_summary)
            if length > 500:
                return 0.9
            elif length > 200:
                return 0.7
            elif length > 100:
                return 0.5
            else:
                return 0.3
                
        elif component == "insights":
            # Based on count and actionability
            count = len(result.key_insights)
            if count >= 5:
                return 0.9
            elif count >= 3:
                return 0.7
            elif count >= 1:
                return 0.5
            else:
                return 0.3
                
        else:
            return getattr(result, "quality_score", 0.7)
    
    def _format_classification_content(self, result: EnrichmentResult) -> str:
        """Format classification data as readable content."""
        lines = []
        
        lines.append(f"## Classification Results\n")
        lines.append(f"**Content Type**: {result.content_type}")
        lines.append(f"**AI Primitives**: {', '.join(result.ai_primitives) if result.ai_primitives else 'None'}")
        lines.append(f"**Vendor**: {result.vendor or 'Not identified'}")
        lines.append(f"**Confidence**: {result.confidence_scores.get('classification', 0.7):.1%}")
        
        if hasattr(result, "classification_reasoning") and result.classification_reasoning:
            lines.append(f"\n**Reasoning**: {result.classification_reasoning}")
            
        return "\n".join(lines)
    
    def _track_prompt_sources(self, result: EnrichmentResult, tracked_results: List[TrackedAnalyzerResult]) -> Dict[str, str]:
        """Track which prompts came from Notion vs YAML."""
        prompt_sources = {}
        
        # Check if we have prompt source info in the result
        if hasattr(result, "prompt_sources"):
            prompt_sources.update(result.prompt_sources)
        
        # Check each tracked result for source info
        for tracked in tracked_results:
            analyzer_key = tracked.analyzer_name.lower().replace(" ", "_")
            
            # Check if result has prompt_source attribute
            if hasattr(tracked, "prompt_source"):
                prompt_sources[analyzer_key] = tracked.prompt_source
            # Check if metadata indicates Notion source
            elif hasattr(tracked.metadata, "prompt_source"):
                prompt_sources[analyzer_key] = tracked.metadata.prompt_source
            # Check if raw response has source info
            elif hasattr(tracked, "raw_response") and tracked.raw_response:
                if tracked.raw_response.get("prompt_source"):
                    prompt_sources[analyzer_key] = tracked.raw_response.get("prompt_source")
            else:
                # Default to YAML if no source info
                prompt_sources[analyzer_key] = "yaml"
        
        return prompt_sources
    
    def _create_raw_content_toggle(self, raw_content: str) -> List[Dict[str, Any]]:
        """Create toggle for raw content (from original implementation)."""
        # Use the chunking logic from original pipeline_processor
        raw_blocks = self._chunk_text_to_blocks(raw_content)
        
        if len(raw_blocks) > 100:
            # Split into multiple toggles
            toggles = []
            for i in range(0, len(raw_blocks), 100):
                chunk_blocks = raw_blocks[i:i+100]
                part_num = (i // 100) + 1
                total_parts = (len(raw_blocks) + 99) // 100
                toggles.append({
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{"type": "text", "text": {"content": f"📄 Raw Content (Part {part_num}/{total_parts})"}}],
                        "children": chunk_blocks
                    }
                })
            return toggles
        else:
            return [{
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📄 Raw Content"}}],
                    "children": raw_blocks
                }
            }]
    
    def _chunk_text_to_blocks(self, text: str, max_length: int = 1900) -> List[Dict[str, Any]]:
        """Chunk text using hierarchical separators (from original)."""
        if not text or not text.strip():
            return []
            
        separators = ["\n\n", "\n", ". ", " ", ""]
        return self._recursive_split(text, separators, max_length)
    
    def _recursive_split(self, text: str, separators: List[str], max_length: int) -> List[Dict[str, Any]]:
        """Recursively split text using separator hierarchy."""
        if len(text) <= max_length or not separators:
            return [{"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": text.strip()}}]}}] if text.strip() else []
        
        separator = separators[0]
        remaining_separators = separators[1:]
        
        if separator == "":
            blocks = []
            for i in range(0, len(text), max_length):
                chunk = text[i:i + max_length]
                if chunk.strip():
                    blocks.append({"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}})
            return blocks
        
        if separator not in text:
            return self._recursive_split(text, remaining_separators, max_length)
        
        chunks = text.split(separator)
        blocks = []
        current_chunk = ""
        
        for i, chunk in enumerate(chunks):
            if current_chunk:
                test_chunk = current_chunk + separator + chunk
            else:
                test_chunk = chunk
            
            if len(test_chunk) <= max_length:
                current_chunk = test_chunk
            else:
                if current_chunk:
                    blocks.extend(self._recursive_split(current_chunk, remaining_separators, max_length))
                current_chunk = chunk
        
        if current_chunk:
            blocks.extend(self._recursive_split(current_chunk, remaining_separators, max_length))
        
        return blocks
    
    def enable_legacy_mode(self):
        """Enable legacy formatting mode."""
        self.use_legacy_formatting = True
        self.logger.info("Legacy formatting mode enabled")
        
    def disable_legacy_mode(self):
        """Disable legacy formatting mode."""
        self.use_legacy_formatting = False
        self.logger.info("Prompt-aware formatting mode enabled")
        
    def set_mobile_optimization(self, enabled: bool):
        """Enable or disable mobile optimization."""
        self.enable_mobile_optimization = enabled
        self.logger.info(f"Mobile optimization {'enabled' if enabled else 'disabled'}")
        
    def set_cross_insights(self, enabled: bool):
        """Enable or disable cross-insight connections."""
        self.enable_cross_insights = enabled
        self.logger.info(f"Cross-insights {'enabled' if enabled else 'disabled'}")