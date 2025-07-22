"""
Enhanced attribution formatter that properly scales quality scores and shows Notion prompt sources.
"""
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from ..utils.logging import setup_logger


class EnhancedAttributionFormatter:
    """Formats attribution with proper quality scaling and clear prompt source indicators."""
    
    def __init__(self, prompt_config=None):
        """Initialize the enhanced attribution formatter."""
        self.logger = setup_logger(__name__)
        self.prompt_config = prompt_config
        
        # Quality thresholds for 0-10 scale
        self.quality_thresholds = {
            "excellent": 9.0,
            "good": 7.0, 
            "acceptable": 5.0,
            "poor": 0
        }
        
        self.quality_indicators = {
            "excellent": "🌟",
            "good": "✅",
            "acceptable": "⚠️",
            "poor": "❌"
        }
        
    def create_attribution_dashboard(self, 
                                   analysis_results: List[Any],
                                   processing_time: float,
                                   prompt_sources: Dict[str, str],
                                   notion_page_ids: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """Create a comprehensive attribution dashboard with proper scaling and source info."""
        blocks = []
        
        # Calculate metrics
        metrics = self._calculate_metrics(analysis_results)
        
        # Main attribution header
        blocks.append(self._create_main_header(metrics, processing_time))
        
        # Metrics summary with scaled quality
        blocks.append(self._create_metrics_summary(metrics, prompt_sources))
        
        # Prompt details showing Notion vs YAML sources with hyperlinks
        blocks.append(self._create_prompt_details(analysis_results, prompt_sources, notion_page_ids))
        
        # Performance timeline
        blocks.append(self._create_performance_timeline(analysis_results))
        
        # Quality footer with prompt flow description
        blocks.append(self._create_quality_footer(metrics, analysis_results, prompt_sources))
        
        return blocks
    
    def _calculate_metrics(self, results: List[Any]) -> Dict[str, Any]:
        """Calculate aggregated metrics from analysis results."""
        total_prompts = len(results)
        total_tokens = sum(r.token_usage.get("total_tokens", 0) for r in results if hasattr(r, "token_usage"))
        
        # Calculate quality scores
        quality_scores = [r.quality_score for r in results if hasattr(r, "quality_score")]
        avg_quality_raw = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        avg_quality_scaled = avg_quality_raw * 10  # Scale to 0-10
        
        # Get quality level and indicator
        quality_level = self._get_quality_level(avg_quality_scaled)
        quality_indicator = self.quality_indicators[quality_level]
        
        # Count Notion vs YAML prompts
        notion_count = sum(1 for r in results if hasattr(r, 'prompt_source') and r.prompt_source == 'notion')
        yaml_count = total_prompts - notion_count
        
        return {
            "total_prompts": total_prompts,
            "total_tokens": total_tokens,
            "avg_quality_raw": avg_quality_raw,
            "avg_quality_scaled": avg_quality_scaled,
            "quality_level": quality_level,
            "quality_indicator": quality_indicator,
            "notion_prompts": notion_count,
            "yaml_prompts": yaml_count
        }
    
    def _create_main_header(self, metrics: Dict[str, Any], processing_time: float) -> Dict[str, Any]:
        """Create the main attribution header."""
        prompt_source_text = ""
        if metrics["notion_prompts"] > 0:
            prompt_source_text = f" (📝 {metrics['notion_prompts']} from Notion)"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"✨ AI Attribution: {metrics['total_prompts']} prompts{prompt_source_text} • {processing_time:.1f}s"
                    }
                }],
                "icon": {"type": "emoji", "emoji": "✨"},
                "color": "gray_background"
            }
        }
    
    def _create_metrics_summary(self, metrics: Dict[str, Any], prompt_sources: Dict[str, str]) -> Dict[str, Any]:
        """Create metrics summary with properly scaled quality score."""
        # Build source indicator
        source_indicator = ""
        if metrics["notion_prompts"] > 0 and metrics["yaml_prompts"] > 0:
            source_indicator = f" (📝 Notion + 📄 YAML)"
        elif metrics["notion_prompts"] > 0:
            source_indicator = f" (📝 Notion)"
        else:
            source_indicator = f" (📄 YAML)"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"📊 {metrics['total_prompts']} Prompts{source_indicator} • {metrics['avg_quality_scaled']:.1f}/10 {metrics['quality_indicator']} • {metrics['total_tokens']:,} Tokens ⚡"
                    }
                }],
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": self._get_quality_color(metrics["quality_level"])
            }
        }
    
    def _create_prompt_details(self, results: List[Any], prompt_sources: Dict[str, str], notion_page_ids: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Create detailed prompt information showing sources with Notion hyperlinks."""
        prompt_children = []
        
        for result in results:
            analyzer_name = getattr(result, 'analyzer_name', 'Unknown')
            quality_raw = getattr(result, 'quality_score', 0.5)
            quality_scaled = quality_raw * 10
            quality_indicator = self.quality_indicators[self._get_quality_level(quality_scaled)]
            
            # Get prompt source
            prompt_source = prompt_sources.get(analyzer_name.lower(), "yaml")
            source_icon = "📝" if prompt_source == "notion" else "📄"
            
            # Get prompt details and page ID
            page_id = None
            if hasattr(result, 'prompt_used') and result.prompt_used:
                prompt = result.prompt_used
                prompt_desc = f"{prompt.prompt_name} v{prompt.version}"
                if hasattr(prompt, 'page_id'):
                    # This indicates it came from Notion
                    page_id = prompt.page_id
                    prompt_desc += f" {source_icon} Notion"
                else:
                    prompt_desc += f" {source_icon} YAML"
            else:
                # Fallback display
                prompt_desc = f"{analyzer_name} {source_icon} {prompt_source.upper()}"
                # Check if we have page ID from notion_page_ids dict
                if notion_page_ids:
                    page_id = notion_page_ids.get(analyzer_name.lower())
            
            # Create list item with hyperlink if from Notion
            item_text = f"{quality_indicator} {prompt_desc} ({quality_scaled:.1f}/10)"
            if page_id and prompt_source == "notion":
                # Create hyperlinked rich text
                prompt_children.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{
                            "type": "text",
                            "text": {
                                "content": item_text,
                                "link": {"url": f"https://www.notion.so/{page_id.replace('-', '')}"}  
                            }
                        }]
                    }
                })
            else:
                # Plain text without link
                prompt_children.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{
                            "type": "text",
                            "text": {"content": item_text}
                        }]
                    }
                })
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"📝 Prompts Used ({len(prompt_children)})"}
                }],
                "children": prompt_children
            }
        }
    
    def _create_performance_timeline(self, results: List[Any]) -> Dict[str, Any]:
        """Create performance timeline with prompt sources."""
        timeline_items = []
        
        for result in results:
            analyzer_name = getattr(result, 'analyzer_name', 'Unknown')
            processing_time = getattr(result, 'processing_time', 0)
            
            # Check if from Notion
            source_indicator = ""
            if hasattr(result, 'prompt_source') and result.prompt_source == 'notion':
                source_indicator = " 📝"
            elif hasattr(result, 'prompt_used') and hasattr(result.prompt_used, 'page_id'):
                source_indicator = " 📝"
            
            timeline_items.append(f"📊 {processing_time:.1f}s → {analyzer_name}{source_indicator} v1.0")
        
        total_time = sum(getattr(r, 'processing_time', 0) for r in results)
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "📈 Performance Timeline"}
                }],
                "children": [
                    {
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": "\n".join(timeline_items)}
                            }]
                        }
                    },
                    {
                        "type": "divider", 
                        "divider": {}
                    },
                    {
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": f"⏱️ Total: {total_time:.1f}s"}
                            }]
                        }
                    }
                ]
            }
        }
    
    def _create_quality_footer(self, metrics: Dict[str, Any], results: List[Any], prompt_sources: Dict[str, str]) -> Dict[str, Any]:
        """Create footer with quality assessment and prompt flow description."""
        # Build prompt flow description
        notion_prompts = []
        yaml_prompts = []
        
        for result in results:
            analyzer_name = getattr(result, 'analyzer_name', 'Unknown')
            source = prompt_sources.get(analyzer_name.lower(), "yaml")
            
            if source == "notion":
                notion_prompts.append(analyzer_name)
            else:
                yaml_prompts.append(analyzer_name)
        
        # Create flow description
        if notion_prompts and yaml_prompts:
            flow_desc = f"🤖 Orchestrated Notion prompts ({', '.join(notion_prompts)}) with YAML fallbacks"
        elif notion_prompts:
            flow_desc = f"🤖 Powered by Notion prompts: {', '.join(notion_prompts)}"
        else:
            flow_desc = f"🤖 Synthesized insights from {len(results)} AI prompts"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"{flow_desc} | Quality: {metrics['avg_quality_scaled']:.1f}/10 {metrics['quality_indicator']}"
                    }
                }],
                "icon": {"type": "emoji", "emoji": "🤖"},
                "color": self._get_quality_color(metrics["quality_level"])
            }
        }
    
    def _get_quality_level(self, scaled_score: float) -> str:
        """Get quality level based on scaled score (0-10)."""
        if scaled_score >= self.quality_thresholds["excellent"]:
            return "excellent"
        elif scaled_score >= self.quality_thresholds["good"]:
            return "good"
        elif scaled_score >= self.quality_thresholds["acceptable"]:
            return "acceptable"
        else:
            return "poor"
    
    def _get_quality_color(self, quality_level: str) -> str:
        """Get Notion color for quality level."""
        colors = {
            "excellent": "green_background",
            "good": "blue_background",
            "acceptable": "yellow_background",
            "poor": "red_background"
        }
        return colors.get(quality_level, "gray_background")