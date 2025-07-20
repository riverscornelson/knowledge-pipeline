"""
Enhanced pipeline processor with integrated prompt-aware formatting.
This module extends the base pipeline processor to use the new formatting system.
"""
import os
from typing import Dict, List, Optional, Any
from .pipeline_processor import PipelineProcessor
from ..core.config import PipelineConfig
from ..core.notion_client import NotionClient
from ..core.models import EnrichmentResult
from ..formatters.formatter_integration import FormatterIntegration
from ..utils.logging import setup_logger


class EnhancedFormattingPipelineProcessor(PipelineProcessor):
    """Pipeline processor with integrated prompt-aware formatting."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize enhanced pipeline processor."""
        super().__init__(config, notion_client)
        
        # Initialize the new formatter integration
        self.formatter_integration = FormatterIntegration(self)
        
        # Configuration flags
        self.use_prompt_aware_formatting = os.getenv('USE_PROMPT_AWARE_FORMATTING', 'true').lower() == 'true'
        self.enable_executive_dashboard = os.getenv('ENABLE_EXECUTIVE_DASHBOARD', 'true').lower() == 'true'
        self.mobile_optimization = os.getenv('MOBILE_OPTIMIZATION', 'true').lower() == 'true'
        
        # Set formatter preferences
        if self.mobile_optimization:
            self.formatter_integration.set_mobile_optimization(True)
            
        if self.enable_executive_dashboard:
            self.formatter_integration.set_cross_insights(True)
            
        self.logger.info(f"Enhanced formatting processor initialized - Prompt-aware: {self.use_prompt_aware_formatting}, Mobile: {self.mobile_optimization}")
    
    def _create_content_blocks(self, result: EnrichmentResult, raw_content: str) -> List[Dict]:
        """Override to use the new prompt-aware formatting system."""
        
        # If prompt-aware formatting is disabled, use parent implementation
        if not self.use_prompt_aware_formatting:
            return super()._create_content_blocks(result, raw_content)
        
        try:
            # Get the current Notion item for context
            # This is a simplified approach - in production, pass the item through the call chain
            item = {"properties": {"Title": {"title": [{"text": {"content": "Document"}}]}}}
            
            # Use the new formatter integration
            blocks = self.formatter_integration.format_enrichment_result(
                result=result,
                item=item,
                raw_content=raw_content
            )
            
            self.logger.info(f"Created {len(blocks)} blocks using prompt-aware formatter")
            
            # Add quality validation section if enabled
            if hasattr(result, 'quality_score'):
                quality_blocks = self._create_enhanced_quality_section(result, raw_content)
                blocks.extend(quality_blocks)
            
            return blocks
            
        except Exception as e:
            self.logger.error(f"Prompt-aware formatting failed, falling back to original: {e}")
            return super()._create_content_blocks(result, raw_content)
    
    def _create_enhanced_quality_section(self, result: EnrichmentResult, raw_content: str) -> List[Dict[str, Any]]:
        """Create enhanced quality validation section with visual indicators."""
        blocks = []
        
        # Add divider
        blocks.append({"type": "divider", "divider": {}})
        
        # Create quality dashboard
        quality_score = getattr(result, 'quality_score', 0)
        quality_emoji = "⭐" if quality_score >= 0.8 else "✅" if quality_score >= 0.6 else "⚠️"
        
        # Quality header with visual indicator
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"{quality_emoji} Quality Validation Dashboard"}
                }]
            }
        })
        
        # Create visual quality bar
        bar_length = int(quality_score * 20)
        quality_bar = "█" * bar_length + "░" * (20 - bar_length)
        
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"Overall Quality: {quality_bar} {quality_score:.1%}"}
                }],
                "icon": {"type": "emoji", "emoji": quality_emoji},
                "color": "green_background" if quality_score >= 0.7 else "yellow_background"
            }
        })
        
        # Detailed metrics in columns
        if self.mobile_optimization:
            # Stack metrics for mobile
            blocks.extend(self._create_stacked_metrics(result, raw_content))
        else:
            # Use columns for desktop
            blocks.extend(self._create_columned_metrics(result, raw_content))
            
        # Add improvement suggestions
        suggestions = self._generate_improvement_suggestions(result)
        if suggestions:
            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "💡 Improvement Suggestions"}}],
                    "children": suggestions
                }
            })
            
        return blocks
    
    def _create_stacked_metrics(self, result: EnrichmentResult, raw_content: str) -> List[Dict[str, Any]]:
        """Create stacked metrics for mobile view."""
        blocks = []
        
        # Summary quality
        summary_score = self._calculate_summary_quality(result)
        blocks.append(self._create_metric_card("📝 Summary Quality", summary_score, len(result.core_summary)))
        
        # Insights quality
        insights_score = self._calculate_insights_quality(result)
        blocks.append(self._create_metric_card("💡 Insights Quality", insights_score, len(result.key_insights)))
        
        # Processing efficiency
        efficiency_score = self._calculate_efficiency_score(result)
        blocks.append(self._create_metric_card("⚡ Processing Efficiency", efficiency_score, result.processing_time))
        
        return blocks
    
    def _create_columned_metrics(self, result: EnrichmentResult, raw_content: str) -> List[Dict[str, Any]]:
        """Create columned metrics for desktop view."""
        columns = []
        
        # Column 1: Summary metrics
        col1_blocks = [self._create_metric_card("📝 Summary", self._calculate_summary_quality(result), len(result.core_summary))]
        columns.append({"type": "column", "column": {"children": col1_blocks}})
        
        # Column 2: Insights metrics
        col2_blocks = [self._create_metric_card("💡 Insights", self._calculate_insights_quality(result), len(result.key_insights))]
        columns.append({"type": "column", "column": {"children": col2_blocks}})
        
        # Column 3: Efficiency metrics
        col3_blocks = [self._create_metric_card("⚡ Efficiency", self._calculate_efficiency_score(result), result.processing_time)]
        columns.append({"type": "column", "column": {"children": col3_blocks}})
        
        return [{
            "type": "column_list",
            "column_list": {"children": columns}
        }]
    
    def _create_metric_card(self, title: str, score: float, detail_value: Any) -> Dict[str, Any]:
        """Create a metric card block."""
        score_emoji = "🟢" if score >= 0.8 else "🟡" if score >= 0.5 else "🔴"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"{title}\n{score_emoji} {score:.1%}\nDetail: {detail_value}"}
                }],
                "icon": {"type": "emoji", "emoji": score_emoji},
                "color": "gray_background"
            }
        }
    
    def _calculate_summary_quality(self, result: EnrichmentResult) -> float:
        """Calculate summary quality score."""
        length = len(result.core_summary)
        if length > 500:
            return 0.9
        elif length > 200:
            return 0.7
        elif length > 100:
            return 0.5
        else:
            return 0.3
    
    def _calculate_insights_quality(self, result: EnrichmentResult) -> float:
        """Calculate insights quality score."""
        count = len(result.key_insights)
        if count >= 5:
            return 0.9
        elif count >= 3:
            return 0.7
        elif count >= 1:
            return 0.5
        else:
            return 0.3
    
    def _calculate_efficiency_score(self, result: EnrichmentResult) -> float:
        """Calculate processing efficiency score."""
        time = result.processing_time
        if time < 5:
            return 0.9
        elif time < 10:
            return 0.7
        elif time < 20:
            return 0.5
        else:
            return 0.3
    
    def _generate_improvement_suggestions(self, result: EnrichmentResult) -> List[Dict[str, Any]]:
        """Generate improvement suggestions based on quality metrics."""
        suggestions = []
        
        # Check summary quality
        if len(result.core_summary) < 200:
            suggestions.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": "Consider adjusting prompts to generate more comprehensive summaries (current: {} chars)".format(len(result.core_summary))}}]
                }
            })
            
        # Check insights count
        if len(result.key_insights) < 3:
            suggestions.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": "Enhance insight extraction to identify more strategic opportunities (current: {} insights)".format(len(result.key_insights))}}]
                }
            })
            
        # Check processing time
        if result.processing_time > 15:
            suggestions.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": "Consider optimizing prompts or using faster models (current: {:.1f}s)".format(result.processing_time)}}]
                }
            })
            
        # Check web search usage
        if hasattr(result, 'web_search_used') and not result.web_search_used:
            suggestions.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": "Enable web search for more current and comprehensive analysis"}}]
                }
            })
            
        return suggestions
    
    def get_formatting_stats(self) -> Dict[str, Any]:
        """Get statistics about formatting usage."""
        stats = {
            "prompt_aware_enabled": self.use_prompt_aware_formatting,
            "mobile_optimization": self.mobile_optimization,
            "executive_dashboard": self.enable_executive_dashboard,
            "formatter_type": "PromptAwareNotionFormatter" if self.use_prompt_aware_formatting else "NotionFormatter"
        }
        
        # Add quality metrics if available
        if hasattr(self, 'quality_metrics'):
            stats.update({
                "avg_quality_score": self.quality_metrics.get("total_quality_score", 0) / max(self.quality_metrics.get("total_processed", 1), 1),
                "total_formatted": self.quality_metrics.get("total_processed", 0)
            })
            
        return stats