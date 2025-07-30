"""
Concrete template implementations for different content types.
"""

from typing import Any, Dict, List

from .models import ActionItem, EnrichedContent, Insight
from .templates import ContentTemplate, TemplateRegistry


class GeneralContentTemplate(ContentTemplate):
    """Default template for general content."""
    
    def get_template_name(self) -> str:
        return "general"
    
    def get_supported_content_types(self) -> List[str]:
        return ["general", "unknown", "other"]
    
    def get_section_order(self) -> List[str]:
        return [
            "quality_indicator",
            "executive_summary",
            "action_items",
            "key_insights",
            "detailed_analysis",
            "strategic_implications",
            "sources",
            "attribution",
            "raw_content",
            "processing_metadata",
        ]
    
    def format_section(
        self,
        section: str,
        content: Any,
        enriched_content: EnrichedContent
    ) -> List[Dict[str, Any]]:
        """Format a section into Notion blocks."""
        if section == "executive_summary":
            return self._format_executive_summary(content)
        elif section == "key_insights":
            return self._format_insights(content)
        elif section == "action_items":
            return self._format_action_items(content)
        elif section == "attribution":
            return self._format_attribution(content)
        elif section == "processing_metadata":
            return self._format_processing_metadata(content)
        elif section == "raw_content":
            return self._format_raw_content(content)
        else:
            # Generic formatting for other sections
            return self._format_generic_section(content)
    
    def _format_executive_summary(self, summary: List[str]) -> List[Dict[str, Any]]:
        """Format executive summary as bullet points."""
        blocks = []
        
        for point in summary[:5]:  # Max 5 points
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": point}
                        }
                    ]
                }
            })
        
        return blocks
    
    def _format_insights(self, insights: List[Insight]) -> List[Dict[str, Any]]:
        """Format insights as numbered list."""
        blocks = []
        
        for i, insight in enumerate(insights[:10], 1):  # Max 10 insights
            # Format insight text with confidence
            text = insight.text
            if insight.confidence < 0.8:
                text += f" (confidence: {insight.confidence:.0%})"
            
            blocks.append({
                "type": "numbered_list_item",
                "numbered_list_item": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": text}
                        }
                    ]
                }
            })
            
            # Add supporting evidence if available
            if insight.supporting_evidence:
                blocks.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": f"Evidence: {insight.supporting_evidence}"},
                                "annotations": {"italic": True, "color": "gray"}
                            }
                        ]
                    }
                })
        
        return blocks
    
    def _format_action_items(self, actions: List[ActionItem]) -> List[Dict[str, Any]]:
        """Format action items with priority indicators."""
        blocks = []
        
        # Group by priority
        priority_groups = {}
        for action in actions:
            if action.priority not in priority_groups:
                priority_groups[action.priority] = []
            priority_groups[action.priority].append(action)
        
        # Format each priority group
        for priority in [ActionPriority.CRITICAL, ActionPriority.HIGH, ActionPriority.MEDIUM, ActionPriority.LOW]:
            if priority not in priority_groups:
                continue
            
            priority_actions = priority_groups[priority]
            if not priority_actions:
                continue
            
            for action in priority_actions:
                emoji = self._get_priority_emoji(action.priority)
                text = f"{emoji} {action.text}"
                
                if action.due_date:
                    text += f" (Due: {action.due_date.strftime('%Y-%m-%d')})"
                
                blocks.append({
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": text}
                            }
                        ],
                        "checked": False
                    }
                })
        
        return blocks
    
    def _format_attribution(self, attribution: Any) -> List[Dict[str, Any]]:
        """Format attribution information."""
        return [{
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"Processed with {attribution.analyzer_name} "
                                     f"using {attribution.model_used} "
                                     f"at {attribution.processing_timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
                        },
                        "annotations": {"italic": True, "color": "gray"}
                    }
                ]
            }
        }]
    
    def _format_processing_metadata(self, metrics: Any) -> List[Dict[str, Any]]:
        """Format processing metadata."""
        blocks = []
        
        # Format as simple list
        metadata_items = [
            f"Processing time: {metrics.processing_time_seconds:.1f}s",
            f"Tokens used: {metrics.tokens_used:,}",
            f"Estimated cost: ${metrics.estimated_cost:.3f}",
            f"Quality score: {metrics.quality_score:.0%}",
            f"Cache hit: {'Yes' if metrics.cache_hit else 'No'}",
        ]
        
        for item in metadata_items:
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": item}
                        }
                    ]
                }
            })
        
        return blocks
    
    def _format_raw_content(self, content: str) -> List[Dict[str, Any]]:
        """Format raw content as code block."""
        if not content:
            return [{
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": "Raw content not available"},
                            "annotations": {"italic": True, "color": "gray"}
                        }
                    ]
                }
            }]
        
        # Truncate if too long
        max_length = 5000
        if len(content) > max_length:
            content = content[:max_length] + "\n\n... (truncated)"
        
        return [{
            "type": "code",
            "code": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": content}
                    }
                ],
                "language": "plain text"
            }
        }]
    
    def _format_generic_section(self, content: Any) -> List[Dict[str, Any]]:
        """Generic formatting for unknown sections."""
        blocks = []
        
        if isinstance(content, list):
            for item in content:
                blocks.append({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": str(item)}
                            }
                        ]
                    }
                })
        elif isinstance(content, dict):
            # Format as key-value pairs
            for key, value in content.items():
                blocks.append({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": f"{key}: "},
                                "annotations": {"bold": True}
                            },
                            {
                                "type": "text",
                                "text": {"content": str(value)}
                            }
                        ]
                    }
                })
        else:
            # Single paragraph
            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": str(content)}
                        }
                    ]
                }
            })
        
        return blocks


class ResearchPaperTemplate(ContentTemplate):
    """Template for research papers and academic content."""
    
    def get_template_name(self) -> str:
        return "research_paper"
    
    def get_supported_content_types(self) -> List[str]:
        return ["research_paper", "academic_paper", "study", "research"]
    
    def get_section_order(self) -> List[str]:
        return [
            "quality_indicator",
            "executive_summary",
            "key_findings",  # Instead of key_insights
            "methodology",
            "statistical_significance",
            "practical_applications",
            "limitations",
            "citations",
            "detailed_analysis",
            "raw_content",
            "processing_metadata",
        ]
    
    def format_section(
        self,
        section: str,
        content: Any,
        enriched_content: EnrichedContent
    ) -> List[Dict[str, Any]]:
        """Format research-specific sections."""
        # Use general template for common sections
        general = GeneralContentTemplate()
        
        if section in ["executive_summary", "processing_metadata", "raw_content"]:
            return general.format_section(section, content, enriched_content)
        elif section == "key_findings":
            return self._format_key_findings(content)
        elif section == "methodology":
            return self._format_methodology(content)
        elif section == "statistical_significance":
            return self._format_statistics(content)
        elif section == "citations":
            return self._format_citations(content)
        else:
            return general._format_generic_section(content)
    
    def _format_key_findings(self, findings: Any) -> List[Dict[str, Any]]:
        """Format key research findings."""
        blocks = []
        
        # Add emphasis on findings
        if isinstance(findings, list):
            for finding in findings:
                blocks.append({
                    "type": "callout",
                    "callout": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": str(finding)}
                            }
                        ],
                        "icon": {"emoji": "🔬"},
                        "color": "blue_background"
                    }
                })
        else:
            blocks.extend(GeneralContentTemplate()._format_generic_section(findings))
        
        return blocks
    
    def _format_methodology(self, methodology: Any) -> List[Dict[str, Any]]:
        """Format research methodology."""
        return [{
            "type": "callout",
            "callout": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "Methodology"},
                        "annotations": {"bold": True}
                    },
                    {
                        "type": "text",
                        "text": {"content": f": {str(methodology)}"}
                    }
                ],
                "icon": {"emoji": "📊"},
                "color": "gray_background"
            }
        }]
    
    def _format_statistics(self, stats: Any) -> List[Dict[str, Any]]:
        """Format statistical significance."""
        # Would format p-values, confidence intervals, etc.
        return GeneralContentTemplate()._format_generic_section(stats)
    
    def _format_citations(self, citations: Any) -> List[Dict[str, Any]]:
        """Format academic citations."""
        blocks = []
        
        if isinstance(citations, list):
            for citation in citations:
                blocks.append({
                    "type": "quote",
                    "quote": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": str(citation)}
                            }
                        ]
                    }
                })
        else:
            blocks.extend(GeneralContentTemplate()._format_generic_section(citations))
        
        return blocks


class MarketNewsTemplate(ContentTemplate):
    """Template for market news and business intelligence."""
    
    def get_template_name(self) -> str:
        return "market_news"
    
    def get_supported_content_types(self) -> List[str]:
        return ["market_news", "news", "market_update", "business_news"]
    
    def get_section_order(self) -> List[str]:
        return [
            "quality_indicator",
            "market_impact",  # First, most important
            "executive_summary",
            "timeline",
            "affected_parties",
            "action_items",
            "competitive_implications",
            "risk_assessment",
            "detailed_analysis",
            "sources",
            "raw_content",
            "processing_metadata",
        ]
    
    def format_section(
        self,
        section: str,
        content: Any,
        enriched_content: EnrichedContent
    ) -> List[Dict[str, Any]]:
        """Format market news specific sections."""
        general = GeneralContentTemplate()
        
        if section in ["executive_summary", "action_items", "processing_metadata", "raw_content"]:
            return general.format_section(section, content, enriched_content)
        elif section == "market_impact":
            return self._format_market_impact(content)
        elif section == "timeline":
            return self._format_timeline(content)
        elif section == "affected_parties":
            return self._format_affected_parties(content)
        elif section == "risk_assessment":
            return self._format_risk_assessment(content)
        else:
            return general._format_generic_section(content)
    
    def _format_market_impact(self, impact: Any) -> List[Dict[str, Any]]:
        """Format market impact with visual indicators."""
        # Determine impact level and color
        impact_str = str(impact).lower()
        if "high" in impact_str or "significant" in impact_str:
            color = "red_background"
            emoji = "📈"
        elif "moderate" in impact_str or "medium" in impact_str:
            color = "yellow_background"
            emoji = "📊"
        else:
            color = "green_background"
            emoji = "📉"
        
        return [{
            "type": "callout",
            "callout": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "Market Impact: "},
                        "annotations": {"bold": True}
                    },
                    {
                        "type": "text",
                        "text": {"content": str(impact)}
                    }
                ],
                "icon": {"emoji": emoji},
                "color": color
            }
        }]
    
    def _format_timeline(self, timeline: Any) -> List[Dict[str, Any]]:
        """Format timeline of events."""
        blocks = []
        
        if isinstance(timeline, list):
            for event in timeline:
                blocks.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": f"📅 {str(event)}"}
                            }
                        ]
                    }
                })
        else:
            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": f"📅 Timeline: {str(timeline)}"},
                            "annotations": {"bold": True}
                        }
                    ]
                }
            })
        
        return blocks
    
    def _format_affected_parties(self, parties: Any) -> List[Dict[str, Any]]:
        """Format affected companies/sectors."""
        blocks = []
        
        if isinstance(parties, list):
            # Format as tags
            tags_text = " • ".join(str(party) for party in parties)
            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": "Affected: "},
                            "annotations": {"bold": True}
                        },
                        {
                            "type": "text",
                            "text": {"content": tags_text},
                            "annotations": {"color": "blue"}
                        }
                    ]
                }
            })
        else:
            blocks.extend(GeneralContentTemplate()._format_generic_section(parties))
        
        return blocks
    
    def _format_risk_assessment(self, risks: Any) -> List[Dict[str, Any]]:
        """Format risk assessment with warnings."""
        return [{
            "type": "callout",
            "callout": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": str(risks)}
                    }
                ],
                "icon": {"emoji": "⚠️"},
                "color": "yellow_background"
            }
        }]


# Register templates
TemplateRegistry.register(GeneralContentTemplate())
TemplateRegistry.register(ResearchPaperTemplate())
TemplateRegistry.register(MarketNewsTemplate())