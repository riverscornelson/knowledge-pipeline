"""
Implementation code for the revolutionary Notion content design.
This module provides the concrete implementation of the prompt-first architecture.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from enum import Enum


class InsightType(Enum):
    """Types of insights with their visual indicators."""
    OPPORTUNITY = ("🚀", "green_background", "Opportunity")
    RISK = ("⚠️", "red_background", "Risk/Warning")
    ACTION = ("🎯", "orange_background", "Action Required")
    INSIGHT = ("💡", "blue_background", "Key Insight")
    DATA = ("📊", "gray_background", "Data/Metrics")
    PREDICTION = ("🔮", "purple_background", "Prediction")


class PromptAttributionFormatter:
    """Formats content with clear prompt attribution."""
    
    def __init__(self):
        self.quality_thresholds = {
            "high": 90,
            "medium": 70,
            "low": 0
        }
    
    def create_executive_dashboard(self, analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Creates the executive intelligence dashboard section."""
        
        # Count insights by type
        insight_counts = self._count_insights_by_type(analysis_results)
        
        blocks = [
            # Dashboard Header
            {
                "type": "heading_1",
                "heading_1": {
                    "rich_text": [{"text": {"content": "🎯 Executive Intelligence Dashboard"}}],
                    "color": "default"
                }
            },
            # Metrics Cards Row
            {
                "type": "column_list",
                "column_list": {
                    "children": self._create_metric_cards(insight_counts)
                }
            },
            # Divider
            {"type": "divider", "divider": {}},
            # Prompt Attribution Overview
            self._create_prompt_attribution_section(analysis_results)
        ]
        
        return blocks
    
    def _create_metric_cards(self, counts: Dict[str, int]) -> List[Dict[str, Any]]:
        """Creates visual metric cards for the dashboard."""
        cards = []
        
        # Define card configurations
        card_configs = [
            (InsightType.ACTION, counts.get('actions', 0)),
            (InsightType.RISK, counts.get('risks', 0)),
            (InsightType.OPPORTUNITY, counts.get('opportunities', 0))
        ]
        
        for insight_type, count in card_configs:
            card = {
                "type": "column",
                "column": {
                    "children": [{
                        "type": "callout",
                        "callout": {
                            "icon": {"type": "emoji", "emoji": insight_type.value[0]},
                            "color": insight_type.value[1],
                            "rich_text": [{
                                "type": "text",
                                "text": {
                                    "content": f"{insight_type.value[2]}\n\n{count} items"
                                },
                                "annotations": {"bold": True}
                            }]
                        }
                    }]
                }
            }
            cards.append(card)
        
        return cards
    
    def _create_prompt_attribution_section(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Creates the prompt attribution overview."""
        
        # Build attribution list
        attribution_items = []
        
        for analyzer_name, data in results.get('analyses', {}).items():
            prompt_info = data.get('prompt_metadata', {})
            quality_score = prompt_info.get('quality_score', 85)
            quality_indicator = self._get_quality_indicator(quality_score)
            
            attribution_items.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": f"{quality_indicator} "},
                        },
                        {
                            "type": "text",
                            "text": {"content": prompt_info.get('prompt_name', analyzer_name)},
                            "annotations": {"bold": True}
                        },
                        {
                            "type": "text",
                            "text": {"content": f" → {data.get('section_title', analyzer_name)}"}
                        },
                        {
                            "type": "text",
                            "text": {
                                "content": f"\n   Model: {prompt_info.get('model', 'GPT-4')} | "
                                          f"Web Search: {'Yes' if data.get('web_search_used') else 'No'} | "
                                          f"Score: {quality_score}%"
                            },
                            "annotations": {"color": "gray"}
                        }
                    ]
                }
            })
        
        return {
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "gray_background",
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "Content Attribution & Prompt Performance"}
                }],
                "children": attribution_items
            }
        }
    
    def create_attributed_content_section(
        self, 
        section_title: str,
        prompt_name: str,
        prompt_id: str,
        content: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Creates a content section with full prompt attribution."""
        
        blocks = []
        
        # Section header with emoji
        emoji = self._get_section_emoji(section_title)
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{
                    "text": {"content": f"{emoji} {section_title}"}
                }]
            }
        })
        
        # Attribution callout
        blocks.append(self._create_attribution_callout(
            prompt_name, prompt_id, metadata
        ))
        
        # Progressive disclosure sections
        blocks.extend([
            self._create_executive_summary_toggle(content.get('summary', '')),
            self._create_key_insights_toggle(content.get('insights', [])),
            self._create_detailed_analysis_toggle(content.get('full_analysis', ''))
        ])
        
        # Add divider before next section
        blocks.append({"type": "divider", "divider": {}})
        
        return blocks
    
    def _create_attribution_callout(
        self, 
        prompt_name: str, 
        prompt_id: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Creates the attribution callout block."""
        
        quality_score = metadata.get('quality_score', 85)
        quality_indicator = self._get_quality_indicator(quality_score)
        
        return {
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": "🔗"},
                "color": "gray_background",
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "Generated by: "}
                    },
                    {
                        "type": "text",
                        "text": {
                            "content": prompt_name,
                            "link": {"url": f"notion://prompt-database/{prompt_id}"}
                        },
                        "annotations": {"bold": True, "color": "blue"}
                    },
                    {
                        "type": "text",
                        "text": {
                            "content": f" {quality_indicator}\n"
                                      f"Quality Score: {quality_score}% | "
                                      f"Model: {metadata.get('model', 'GPT-4')} | "
                                      f"Generated: {self._format_timestamp(metadata.get('timestamp'))}"
                        }
                    }
                    
                ] + self._add_web_search_info(metadata)
            }
        }
    
    def _add_web_search_info(self, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Adds web search information if present."""
        if not metadata.get('web_search_used'):
            return []
        
        citations = metadata.get('web_citations', [])
        if not citations:
            return []
        
        rich_text = [{
            "type": "text",
            "text": {"content": f"\n🔍 Web sources: "},
            "annotations": {"italic": True}
        }]
        
        for i, citation in enumerate(citations[:3]):  # Show first 3
            if i > 0:
                rich_text.append({"type": "text", "text": {"content": " | "}})
            
            rich_text.append({
                "type": "text",
                "text": {
                    "content": citation.get('domain', 'Source'),
                    "link": {"url": citation.get('url', '')}
                },
                "annotations": {"color": "blue"}
            })
        
        if len(citations) > 3:
            rich_text.append({
                "type": "text",
                "text": {"content": f" (+{len(citations)-3} more)"}
            })
        
        return rich_text
    
    def _create_executive_summary_toggle(self, summary: str) -> Dict[str, Any]:
        """Creates the executive summary toggle section."""
        
        # Format summary into bullet points
        summary_blocks = []
        
        if summary:
            # Split into key points
            points = self._extract_key_points(summary, max_points=3)
            
            for point in points:
                summary_blocks.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": self._parse_and_format_text(point)
                    }
                })
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "📋 Executive Summary"},
                    "annotations": {"bold": True}
                }],
                "children": summary_blocks
            }
        }
    
    def _create_key_insights_toggle(self, insights: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Creates the key insights toggle section with categorized insights."""
        
        insight_blocks = []
        
        # Group insights by type
        grouped_insights = self._group_insights_by_type(insights)
        
        for insight_type, items in grouped_insights.items():
            for item in items:
                insight_blocks.append(self._create_insight_callout(item, insight_type))
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "💡 Key Insights & Findings"},
                    "annotations": {"bold": True}
                }],
                "children": insight_blocks
            }
        }
    
    def _create_insight_callout(self, insight: Dict[str, Any], insight_type: InsightType) -> Dict[str, Any]:
        """Creates a formatted insight callout."""
        
        # Build rich text content
        rich_text = [
            {
                "type": "text",
                "text": {"content": insight.get('title', 'Insight')},
                "annotations": {"bold": True}
            },
            {
                "type": "text",
                "text": {"content": f"\n\n{insight.get('description', '')}\n\n"}
            }
        ]
        
        # Add metadata
        metadata_parts = []
        if insight.get('impact'):
            metadata_parts.append(f"Impact: {insight['impact']}")
        if insight.get('timeline'):
            metadata_parts.append(f"Timeline: {insight['timeline']}")
        if insight.get('confidence'):
            metadata_parts.append(f"Confidence: {insight['confidence']}")
        
        if metadata_parts:
            rich_text.append({
                "type": "text",
                "text": {"content": " | ".join(metadata_parts)},
                "annotations": {"italic": True, "color": "gray"}
            })
        
        return {
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": insight_type.value[0]},
                "color": insight_type.value[1],
                "rich_text": rich_text
            }
        }
    
    def _create_detailed_analysis_toggle(self, analysis: str) -> Dict[str, Any]:
        """Creates the detailed analysis toggle section."""
        
        # Parse the analysis into structured blocks
        analysis_blocks = self._parse_analysis_content(analysis)
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "📊 Detailed Analysis"},
                    "annotations": {"bold": True}
                }],
                "children": analysis_blocks
            }
        }
    
    def create_mobile_insight_card(self, insight: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a mobile-optimized insight card."""
        
        insight_type = self._determine_insight_type(insight)
        
        return {
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": insight_type.value[0]},
                "color": insight_type.value[1],
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": insight.get('title', '')},
                        "annotations": {"bold": True}
                    },
                    {
                        "type": "text",
                        "text": {"content": f"\n\n{self._truncate_for_mobile(insight.get('summary', ''))}"}
                    },
                    {
                        "type": "text",
                        "text": {
                            "content": f"\n\nImpact: {insight.get('impact', 'Medium')} | "
                                      f"Timeline: {insight.get('timeline', 'Ongoing')}"
                        },
                        "annotations": {"color": "gray", "italic": True}
                    }
                ]
            }
        }
    
    # Helper methods
    
    def _count_insights_by_type(self, results: Dict[str, Any]) -> Dict[str, int]:
        """Counts insights by their type across all analyses."""
        counts = {
            'actions': 0,
            'risks': 0,
            'opportunities': 0,
            'insights': 0
        }
        
        for analysis in results.get('analyses', {}).values():
            for insight in analysis.get('insights', []):
                insight_type = insight.get('type', 'insight').lower()
                if insight_type in counts:
                    counts[insight_type] += 1
                else:
                    counts['insights'] += 1
        
        return counts
    
    def _get_quality_indicator(self, score: int) -> str:
        """Returns quality indicator emoji based on score."""
        if score >= self.quality_thresholds['high']:
            return "✅"
        elif score >= self.quality_thresholds['medium']:
            return "⚠️"
        else:
            return "❌"
    
    def _get_section_emoji(self, title: str) -> str:
        """Returns appropriate emoji for section title."""
        title_lower = title.lower()
        
        emoji_map = {
            'market': '📈',
            'technical': '🔧',
            'strategy': '🔮',
            'financial': '💰',
            'risk': '⚠️',
            'opportunity': '🚀',
            'analysis': '🧠',
            'research': '🔬',
            'innovation': '💡',
            'security': '🔒'
        }
        
        for keyword, emoji in emoji_map.items():
            if keyword in title_lower:
                return emoji
        
        return '📊'  # Default
    
    def _format_timestamp(self, timestamp: Optional[str]) -> str:
        """Formats timestamp for display."""
        if not timestamp:
            return "Just now"
        
        try:
            dt = datetime.fromisoformat(timestamp)
            now = datetime.now()
            diff = now - dt
            
            if diff.days > 0:
                return f"{diff.days} days ago"
            elif diff.seconds > 3600:
                return f"{diff.seconds // 3600} hours ago"
            elif diff.seconds > 60:
                return f"{diff.seconds // 60} minutes ago"
            else:
                return "Just now"
        except:
            return timestamp
    
    def _extract_key_points(self, text: str, max_points: int = 3) -> List[str]:
        """Extracts key points from text."""
        # Simple implementation - in production, use NLP
        sentences = text.split('. ')
        key_points = []
        
        for sentence in sentences[:max_points]:
            if len(sentence) > 20:  # Filter out very short sentences
                key_points.append(sentence.strip() + '.')
        
        return key_points
    
    def _parse_and_format_text(self, text: str) -> List[Dict[str, Any]]:
        """Parses text and applies rich formatting."""
        # Simple implementation - detect bold, italic, links
        return [{"type": "text", "text": {"content": text}}]
    
    def _group_insights_by_type(self, insights: List[Dict[str, Any]]) -> Dict[InsightType, List[Dict[str, Any]]]:
        """Groups insights by their type."""
        grouped = {}
        
        for insight in insights:
            insight_type = self._determine_insight_type(insight)
            if insight_type not in grouped:
                grouped[insight_type] = []
            grouped[insight_type].append(insight)
        
        return grouped
    
    def _determine_insight_type(self, insight: Dict[str, Any]) -> InsightType:
        """Determines the type of an insight based on content."""
        type_str = insight.get('type', '').lower()
        content = insight.get('title', '').lower() + insight.get('description', '').lower()
        
        if 'action' in type_str or 'action' in content or 'must' in content or 'should' in content:
            return InsightType.ACTION
        elif 'risk' in type_str or 'risk' in content or 'threat' in content or 'warning' in content:
            return InsightType.RISK
        elif 'opportunity' in type_str or 'opportunity' in content or 'potential' in content:
            return InsightType.OPPORTUNITY
        elif 'predict' in content or 'forecast' in content or 'future' in content:
            return InsightType.PREDICTION
        elif 'data' in type_str or 'metric' in content or 'number' in content:
            return InsightType.DATA
        else:
            return InsightType.INSIGHT
    
    def _parse_analysis_content(self, analysis: str) -> List[Dict[str, Any]]:
        """Parses analysis content into structured blocks."""
        blocks = []
        
        # Split into paragraphs
        paragraphs = analysis.split('\n\n')
        
        for para in paragraphs:
            if para.strip():
                # Check if it's a list
                if para.strip().startswith(('- ', '* ', '• ')):
                    # Convert to bulleted list
                    items = para.strip().split('\n')
                    for item in items:
                        blocks.append({
                            "type": "bulleted_list_item",
                            "bulleted_list_item": {
                                "rich_text": [{
                                    "type": "text",
                                    "text": {"content": item.lstrip('- *•').strip()}
                                }]
                            }
                        })
                else:
                    # Regular paragraph
                    blocks.append({
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": para.strip()}
                            }]
                        }
                    })
        
        return blocks
    
    def _truncate_for_mobile(self, text: str, max_chars: int = 150) -> str:
        """Truncates text for mobile display."""
        if len(text) <= max_chars:
            return text
        
        # Find last complete word before limit
        truncated = text[:max_chars]
        last_space = truncated.rfind(' ')
        if last_space > 0:
            truncated = truncated[:last_space]
        
        return truncated + "..."


# Usage Example
if __name__ == "__main__":
    formatter = PromptAttributionFormatter()
    
    # Sample analysis results with prompt attribution
    sample_results = {
        "analyses": {
            "market_analyzer": {
                "section_title": "Market Analysis",
                "prompt_metadata": {
                    "prompt_name": "Market_News_Insights_v2.1",
                    "prompt_id": "prompt-123",
                    "quality_score": 95,
                    "model": "GPT-4",
                    "timestamp": "2024-01-20T10:30:00"
                },
                "web_search_used": True,
                "web_citations": [
                    {"title": "AI Market Report", "url": "https://example.com/ai-report", "domain": "example.com"},
                    {"title": "Tech Trends 2024", "url": "https://techsite.com/trends", "domain": "techsite.com"}
                ],
                "summary": "The AI market is experiencing unprecedented growth. Key players are investing heavily in generative AI. Market valuation expected to reach $500B by 2025.",
                "insights": [
                    {
                        "type": "opportunity",
                        "title": "Emerging AI Market Segment",
                        "description": "Enterprise AI adoption is accelerating with 45% YoY growth",
                        "impact": "High",
                        "timeline": "6-12 months"
                    },
                    {
                        "type": "risk",
                        "title": "Regulatory Challenges",
                        "description": "New AI regulations may impact deployment timelines",
                        "impact": "Medium",
                        "timeline": "3-6 months"
                    }
                ],
                "full_analysis": "Detailed market analysis text goes here..."
            }
        }
    }
    
    # Generate dashboard
    dashboard_blocks = formatter.create_executive_dashboard(sample_results)
    
    # Generate attributed content section
    content_blocks = formatter.create_attributed_content_section(
        section_title="Market Analysis",
        prompt_name="Market_News_Insights_v2.1",
        prompt_id="prompt-123",
        content=sample_results["analyses"]["market_analyzer"],
        metadata=sample_results["analyses"]["market_analyzer"]["prompt_metadata"]
    )
    
    print(f"Generated {len(dashboard_blocks)} dashboard blocks")
    print(f"Generated {len(content_blocks)} content blocks")