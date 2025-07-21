"""
Notion Block Generator 2.0 - Enhanced with Prompt Attribution
=============================================================

This module creates rich Notion blocks with full prompt traceability,
performance indicators, and feedback mechanisms.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import re
from ..utils.logging import setup_logger


class PromptAwareBlockGenerator:
    """Generates Notion blocks with prompt attribution and metadata."""
    
    def __init__(self):
        """Initialize the block generator."""
        self.logger = setup_logger(__name__)
        
        # Visual indicators for quality scores
        self.quality_indicators = {
            (0.9, 1.0): "⭐⭐⭐⭐⭐",
            (0.8, 0.9): "⭐⭐⭐⭐",
            (0.7, 0.8): "⭐⭐⭐",
            (0.6, 0.7): "⭐⭐",
            (0.0, 0.6): "⭐"
        }
        
        # Performance emojis
        self.performance_emojis = {
            "fast": "🚀",      # < 1s
            "normal": "⚡",    # 1-3s
            "slow": "🐌"       # > 3s
        }
        
    def create_header_block(self, title: str, subtitle: Optional[str] = None) -> Dict[str, Any]:
        """Create a header block with optional subtitle."""
        blocks = []
        
        # Main header
        blocks.append({
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"type": "text", "text": {"content": title}}]
            }
        })
        
        # Subtitle if provided
        if subtitle:
            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text", 
                            "text": {"content": subtitle},
                            "annotations": {"italic": True, "color": "gray"}
                        }
                    ]
                }
            })
        
        return blocks
    
    def create_prompt_attribution_block(self, result: 'TrackedAnalyzerResult') -> Dict[str, Any]:
        """Create a block showing prompt attribution and performance."""
        # Determine quality rating
        quality_stars = self._get_quality_stars(result.quality_score)
        
        # Determine performance indicator
        perf_emoji = self._get_performance_emoji(result.generation_time_ms)
        
        # Build attribution text
        lines = [
            f"**Prompt**: [{result.prompt_name} v{result.prompt_version}]({result.prompt_page_url})",
            f"**Quality**: {quality_stars} ({result.quality_score:.0%})",
            f"**Confidence**: {result.confidence_score:.0%} | **Coherence**: {result.coherence_score:.0%}",
            f"**Performance**: {perf_emoji} {result.generation_time_ms}ms | **Tokens**: {result.token_count:,}"
        ]
        
        if result.web_search_enabled:
            lines.append(f"**Web Search**: ✅ Enabled ({len(result.citations)} sources)")
        
        # Add A/B test indicator if applicable
        if hasattr(result, 'ab_test_group') and result.ab_test_group:
            lines.append(f"**A/B Test**: Group {result.ab_test_group}")
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": self._format_rich_text("\n".join(lines)),
                "icon": {"type": "emoji", "emoji": "🎯"},
                "color": self._get_quality_color(result.quality_score)
            }
        }
    
    def create_content_section(self, result: 'TrackedAnalyzerResult') -> List[Dict[str, Any]]:
        """Create blocks for the main content with smart formatting."""
        blocks = []
        
        # Section header with quality indicator
        header_emoji = self._get_analyzer_emoji(result.analyzer_type)
        quality_indicator = "✨" if result.quality_score >= 0.8 else ""
        
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [
                    {"type": "text", "text": {"content": f"{header_emoji} {result.analyzer_type.title()} {quality_indicator}"}}
                ]
            }
        })
        
        # Key points in a toggle if many
        if result.key_points:
            if len(result.key_points) > 3:
                blocks.append(self._create_toggle_list(
                    "🎯 Key Points",
                    result.key_points,
                    color="blue_background"
                ))
            else:
                blocks.extend(self._create_bullet_list(result.key_points, emoji="🎯"))
        
        # Main content with smart paragraphing
        content_blocks = self._format_content_intelligently(result.content)
        blocks.extend(content_blocks)
        
        # Action items with priority
        if result.action_items:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "⚡ Action Items"}}]
                }
            })
            
            for i, action in enumerate(result.action_items, 1):
                blocks.append({
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [
                            {"type": "text", "text": {"content": f"{i}. {action}"}}
                        ],
                        "checked": False
                    }
                })
        
        # Citations with preview
        if result.citations:
            blocks.extend(self._create_citation_section(result.citations))
        
        return blocks
    
    def create_cross_insights_section(self, cross_insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create blocks for cross-prompt intelligence insights."""
        blocks = []
        
        blocks.append({
            "type": "heading_2", 
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "🔗 Cross-Analysis Insights"}}]
            }
        })
        
        # Consolidated actions with source attribution
        if cross_insights.get("consolidated_actions"):
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "📋 Consolidated Action Plan"}}]
                }
            })
            
            for action in cross_insights["consolidated_actions"][:5]:  # Top 5
                source_text = f" (from {', '.join(action['sources'])})"
                priority_emoji = "🔴" if action["priority"] > 0.8 else "🟡" if action["priority"] > 0.5 else "🟢"
                
                blocks.append({
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [
                            {"type": "text", "text": {"content": f"{priority_emoji} {action['text']}{source_text}"}}
                        ],
                        "checked": False
                    }
                })
        
        # Common themes
        if cross_insights.get("topic_clusters"):
            blocks.append(self._create_topic_cluster_block(cross_insights["topic_clusters"]))
        
        # Quality comparison
        if cross_insights.get("quality_comparison"):
            blocks.append(self._create_quality_comparison_table(cross_insights["quality_comparison"]))
        
        return blocks
    
    def create_feedback_section(self, results: List['TrackedAnalyzerResult']) -> List[Dict[str, Any]]:
        """Create interactive feedback collection section."""
        blocks = []
        
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📊 Feedback & Ratings"}}]
            }
        })
        
        # Instructions
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [
                    {"type": "text", "text": {
                        "content": "Help us improve! Rate each analysis section and let us know which insights were most valuable."
                    }}
                ],
                "icon": {"type": "emoji", "emoji": "💡"},
                "color": "blue_background"
            }
        })
        
        # Create synced blocks for each analyzer (allows rating to persist)
        for result in results:
            blocks.append(self._create_rating_block(result))
        
        # Overall feedback toggle
        blocks.append({
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "💭 Additional Feedback"}}],
                "children": [
                    {
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [
                                {"type": "text", "text": {
                                    "content": "What would make this analysis more useful? Any missing insights?"
                                }}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [
                                {"type": "text", "text": {"content": "[Your feedback here]"}}
                            ]
                        }
                    }
                ]
            }
        })
        
        return blocks
    
    def create_performance_dashboard(self, results: List['TrackedAnalyzerResult']) -> Dict[str, Any]:
        """Create a performance dashboard showing all prompts' metrics."""
        # Calculate aggregates
        total_time = sum(r.generation_time_ms for r in results)
        total_tokens = sum(r.token_count for r in results)
        avg_quality = sum(r.quality_score for r in results) / len(results) if results else 0
        
        # Estimate costs (GPT-4 pricing example)
        cost_per_1k_tokens = 0.03  # $0.03 per 1K tokens
        estimated_cost = (total_tokens / 1000) * cost_per_1k_tokens
        
        dashboard_text = f"""
**Performance Summary**
• Total Generation Time: {total_time}ms ({total_time/1000:.1f}s)
• Total Tokens Used: {total_tokens:,}
• Average Quality Score: {avg_quality:.0%}
• Estimated Cost: ${estimated_cost:.3f}

**Prompt Performance**
"""
        
        # Add individual prompt metrics
        for result in results:
            efficiency = result.quality_score / (result.generation_time_ms / 1000)  # Quality per second
            dashboard_text += f"\n• {result.analyzer_type}: {result.quality_score:.0%} quality, {result.generation_time_ms}ms, efficiency: {efficiency:.1f}"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": self._format_rich_text(dashboard_text),
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "purple_background"
            }
        }
    
    # Helper methods
    
    def _get_quality_stars(self, score: float) -> str:
        """Convert quality score to star rating."""
        for (min_score, max_score), stars in self.quality_indicators.items():
            if min_score <= score < max_score:
                return stars
        return "⭐"
    
    def _get_performance_emoji(self, time_ms: int) -> str:
        """Get performance emoji based on generation time."""
        if time_ms < 1000:
            return self.performance_emojis["fast"]
        elif time_ms < 3000:
            return self.performance_emojis["normal"]
        else:
            return self.performance_emojis["slow"]
    
    def _get_quality_color(self, score: float) -> str:
        """Get Notion color based on quality score."""
        if score >= 0.8:
            return "green_background"
        elif score >= 0.6:
            return "yellow_background"
        else:
            return "red_background"
    
    def _get_analyzer_emoji(self, analyzer_type: str) -> str:
        """Get emoji for analyzer type."""
        emoji_map = {
            "summarizer": "📋",
            "insights": "💡", 
            "classifier": "🏷️",
            "technical": "🔧",
            "strategic": "🎯",
            "market": "📊",
            "risks": "⚠️",
            "opportunities": "🚀"
        }
        return emoji_map.get(analyzer_type.lower(), "🤖")
    
    def _format_rich_text(self, text: str) -> List[Dict[str, Any]]:
        """Convert markdown-style text to Notion rich text."""
        # Parse bold, italic, links
        rich_text = []
        
        # Simple regex-based parsing
        parts = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))', text)
        
        for part in parts:
            if part.startswith('**') and part.endswith('**'):
                # Bold
                rich_text.append({
                    "type": "text",
                    "text": {"content": part[2:-2]},
                    "annotations": {"bold": True}
                })
            elif part.startswith('*') and part.endswith('*'):
                # Italic
                rich_text.append({
                    "type": "text",
                    "text": {"content": part[1:-1]},
                    "annotations": {"italic": True}
                })
            elif re.match(r'\[[^\]]+\]\([^)]+\)', part):
                # Link
                match = re.match(r'\[([^\]]+)\]\(([^)]+)\)', part)
                if match:
                    rich_text.append({
                        "type": "text",
                        "text": {"content": match.group(1), "link": {"url": match.group(2)}}
                    })
            else:
                # Plain text
                if part:
                    rich_text.append({
                        "type": "text",
                        "text": {"content": part}
                    })
        
        return rich_text
    
    def _create_toggle_list(self, title: str, items: List[str], color: str = "default") -> Dict[str, Any]:
        """Create a toggle block containing a list."""
        children = []
        for item in items:
            children.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": item}}]
                }
            })
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": title}}],
                "children": children,
                "color": color
            }
        }
    
    def _create_bullet_list(self, items: List[str], emoji: Optional[str] = None) -> List[Dict[str, Any]]:
        """Create bullet list blocks."""
        blocks = []
        for item in items:
            text = f"{emoji} {item}" if emoji else item
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": text}}]
                }
            })
        return blocks
    
    def _format_content_intelligently(self, content: str) -> List[Dict[str, Any]]:
        """Format content with intelligent paragraph breaks and structure."""
        blocks = []
        
        # Split into paragraphs
        paragraphs = content.split('\n\n')
        
        for para in paragraphs:
            if not para.strip():
                continue
            
            # Check if it's a list
            if re.match(r'^\s*[-•*]\s', para) or re.match(r'^\s*\d+[.)]\s', para):
                # Format as list
                lines = para.strip().split('\n')
                for line in lines:
                    clean_line = re.sub(r'^\s*[-•*]\s*', '', line)
                    clean_line = re.sub(r'^\s*\d+[.)]\s*', '', line)
                    blocks.append({
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": self._format_rich_text(clean_line)
                        }
                    })
            else:
                # Regular paragraph
                blocks.append({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": self._format_rich_text(para.strip())
                    }
                })
        
        return blocks
    
    def _create_citation_section(self, citations: List['Citation']) -> List[Dict[str, Any]]:
        """Create a formatted citation section."""
        blocks = []
        
        blocks.append({
            "type": "heading_3",
            "heading_3": {
                "rich_text": [{"type": "text", "text": {"content": "🔍 Sources & References"}}]
            }
        })
        
        # Group by domain
        by_domain = {}
        for citation in citations:
            domain = citation.domain or "Unknown"
            if domain not in by_domain:
                by_domain[domain] = []
            by_domain[domain].append(citation)
        
        # Create citation blocks
        for domain, cites in by_domain.items():
            domain_text = f"**{domain}** ({len(cites)} sources)"
            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": self._format_rich_text(domain_text)
                }
            })
            
            for cite in cites:
                relevance_indicator = "🟢" if cite.relevance_score > 0.8 else "🟡" if cite.relevance_score > 0.5 else "⚪"
                blocks.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [
                            {"type": "text", "text": {"content": f"{relevance_indicator} "}},
                            {"type": "text", "text": {"content": cite.title, "link": {"url": cite.url}}}
                        ]
                    }
                })
        
        return blocks
    
    def _create_rating_block(self, result: 'TrackedAnalyzerResult') -> Dict[str, Any]:
        """Create a rating block for a specific analyzer result."""
        rating_id = f"rating_{result.prompt_id}_{datetime.now().timestamp()}"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [
                    {"type": "text", "text": {"content": f"{result.analyzer_type.title()}: "}},
                    {"type": "text", "text": {"content": "Rate this analysis → "}},
                    {"type": "text", "text": {"content": "⭐⭐⭐⭐⭐"}}
                ],
                "icon": {"type": "emoji", "emoji": self._get_analyzer_emoji(result.analyzer_type)},
                "color": "gray_background"
            }
        }
    
    def _create_topic_cluster_block(self, clusters: Dict[str, List[str]]) -> Dict[str, Any]:
        """Create a visual representation of topic clusters."""
        cluster_text = "**Common Themes Identified:**\n"
        
        for topic, items in list(clusters.items())[:5]:  # Top 5 clusters
            cluster_text += f"\n• **{topic}**: {', '.join(items[:3])}"
            if len(items) > 3:
                cluster_text += f" (+{len(items)-3} more)"
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": self._format_rich_text(cluster_text),
                "icon": {"type": "emoji", "emoji": "🔮"},
                "color": "blue_background"
            }
        }
    
    def _create_quality_comparison_table(self, comparison_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a table comparing quality across prompts."""
        # Create table structure
        table_rows = []
        
        # Header
        table_rows.append({
            "type": "table_row",
            "table_row": {
                "cells": [
                    [{"type": "text", "text": {"content": "Analyzer"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Quality"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Speed"}, "annotations": {"bold": True}}],
                    [{"type": "text", "text": {"content": "Efficiency"}, "annotations": {"bold": True}}]
                ]
            }
        })
        
        # Data rows
        for item in comparison_data:
            table_rows.append({
                "type": "table_row",
                "table_row": {
                    "cells": [
                        [{"type": "text", "text": {"content": item["analyzer"]}}],
                        [{"type": "text", "text": {"content": f"{item['quality']:.0%}"}}],
                        [{"type": "text", "text": {"content": f"{item['speed_ms']}ms"}}],
                        [{"type": "text", "text": {"content": f"{item['efficiency']:.1f}"}}]
                    ]
                }
            })
        
        return {
            "type": "table",
            "table": {
                "table_width": 4,
                "has_column_header": True,
                "children": table_rows
            }
        }