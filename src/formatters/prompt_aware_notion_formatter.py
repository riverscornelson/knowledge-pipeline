"""
Prompt-aware Notion formatter that provides rich attribution and mobile-responsive formatting.
Transforms AI-generated content into visually appealing Notion blocks with clear prompt attribution.
"""
import re
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass
from datetime import datetime
from utils.logging import setup_logger
from core.notion_client import NotionClient


@dataclass
class PromptMetadata:
    """Metadata about the prompt used to generate content."""
    analyzer_name: str
    prompt_version: str
    content_type: str
    temperature: float
    web_search_used: bool
    quality_score: float
    processing_time: float
    token_usage: Dict[str, int]
    citations: List[Dict[str, str]] = None
    confidence_scores: Dict[str, float] = None


@dataclass 
class TrackedAnalyzerResult:
    """Result from an analyzer with full tracking information."""
    analyzer_name: str
    content: str
    metadata: PromptMetadata
    raw_response: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class PromptAwareNotionFormatter:
    """Advanced Notion formatter with prompt attribution and mobile optimization."""
    
    def __init__(self, notion_client: NotionClient, prompt_db_id: Optional[str] = None):
        """Initialize the formatter with Notion client and optional prompt database."""
        self.notion = notion_client
        self.prompt_db_id = prompt_db_id
        self.prompt_cache = {}
        self.logger = setup_logger(__name__)
        
        # Visual indicators for different quality levels
        self.quality_indicators = {
            "excellent": "⭐",
            "good": "✅", 
            "acceptable": "✓",
            "poor": "⚠️"
        }
        
        # Colors for different content types
        self.content_colors = {
            "executive_summary": "blue_background",
            "insights": "green_background",
            "risks": "red_background",
            "opportunities": "purple_background",
            "technical": "gray_background",
            "financial": "yellow_background",
            "default": "default"
        }
        
        # Mobile optimization settings
        self.mobile_line_length = 50
        self.mobile_preview_length = 80
        
    def format_with_attribution(self, 
                              content: str, 
                              prompt_metadata: PromptMetadata,
                              content_type: str) -> List[Dict[str, Any]]:
        """Format content with full prompt attribution and quality indicators."""
        blocks = []
        
        # Create attribution header
        blocks.append(self._create_attribution_header(prompt_metadata))
        
        # Format main content based on type
        if content_type == "executive_dashboard":
            blocks.extend(self._format_executive_content(content, prompt_metadata))
        elif content_type == "insights":
            blocks.extend(self._format_insights_content(content, prompt_metadata))
        elif content_type == "technical_analysis":
            blocks.extend(self._format_technical_content(content, prompt_metadata))
        else:
            blocks.extend(self._format_general_content(content, prompt_metadata))
            
        # Add quality footer
        blocks.append(self._create_quality_footer(prompt_metadata))
        
        return blocks
    
    def create_executive_dashboard(self, 
                                 all_results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Create top-level executive summary with key metrics and visual hierarchy."""
        blocks = []
        
        # Dashboard header with timestamp
        blocks.append(self._create_dashboard_header())
        
        # Key metrics callout
        blocks.append(self._create_metrics_callout(all_results))
        
        # Quality overview with visual indicators
        blocks.append(self._create_quality_overview(all_results))
        
        # Executive insights in columns
        blocks.extend(self._create_executive_columns(all_results))
        
        # Cross-analyzer insights
        blocks.extend(self._create_cross_insights(all_results))
        
        # Action items consolidated
        blocks.append(self._create_action_items_database(all_results))
        
        return blocks
    
    def create_prompt_attributed_section(self,
                                       result: TrackedAnalyzerResult) -> List[Dict[str, Any]]:
        """Create a section with clear prompt attribution and quality indicators."""
        blocks = []
        
        # Section header with analyzer name and quality
        blocks.append(self._create_section_header(result))
        
        # Prompt configuration callout
        blocks.append(self._create_prompt_config_callout(result.metadata))
        
        # Main content with mobile optimization
        content_blocks = self._format_with_mobile_optimization(
            result.content, 
            result.metadata.content_type
        )
        blocks.extend(content_blocks)
        
        # Citations if available
        if result.metadata.citations:
            blocks.append(self._create_citations_block(result.metadata.citations))
            
        # Performance metrics toggle
        blocks.append(self._create_performance_toggle(result.metadata))
        
        return blocks
    
    def optimize_for_mobile(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Transform blocks for mobile-friendly viewing."""
        mobile_blocks = []
        
        for block in blocks:
            block_type = block.get("type")
            
            if block_type == "table":
                # Convert tables to card layout
                mobile_blocks.extend(self._table_to_cards(block))
            elif block_type == "column_list":
                # Convert columns to stacked layout
                mobile_blocks.extend(self._columns_to_stack(block))
            elif block_type in ["paragraph", "bulleted_list_item", "numbered_list_item"]:
                # Shorten lines for mobile
                mobile_blocks.append(self._optimize_text_block(block))
            elif block_type == "toggle":
                # Add preview text to toggles
                mobile_blocks.append(self._add_toggle_preview(block))
            else:
                mobile_blocks.append(block)
                
        return mobile_blocks
    
    def add_quality_indicators(self, block: Dict[str, Any], quality_score: float) -> Dict[str, Any]:
        """Add visual quality indicators to blocks."""
        # Determine quality level
        if quality_score >= 0.9:
            indicator = self.quality_indicators["excellent"]
            color = "green"
        elif quality_score >= 0.7:
            indicator = self.quality_indicators["good"]
            color = "green"
        elif quality_score >= 0.5:
            indicator = self.quality_indicators["acceptable"]
            color = "yellow"
        else:
            indicator = self.quality_indicators["poor"]
            color = "red"
            
        # Add indicator to block based on type
        block_type = block.get("type")
        if block_type in ["heading_1", "heading_2", "heading_3"]:
            # Prepend indicator to heading text
            rich_text = block[block_type]["rich_text"]
            if rich_text and rich_text[0].get("text"):
                original_text = rich_text[0]["text"]["content"]
                rich_text[0]["text"]["content"] = f"{indicator} {original_text}"
                
        elif block_type == "callout":
            # Update callout icon
            block["callout"]["icon"] = {"type": "emoji", "emoji": indicator}
            
        return block
    
    def create_insight_connections(self, all_results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Link related insights across different prompts."""
        blocks = []
        
        # Extract all insights with their sources
        all_insights = self._extract_all_insights(all_results)
        
        # Group by semantic similarity
        insight_groups = self._group_similar_insights(all_insights)
        
        # Create synced blocks for cross-references
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "🔗 Connected Insights"}}]
            }
        })
        
        for group_name, insights in insight_groups.items():
            blocks.append(self._create_insight_group_block(group_name, insights))
            
        return blocks
    
    # Private helper methods
    
    def _create_attribution_header(self, metadata: PromptMetadata) -> Dict[str, Any]:
        """Create a header showing which prompt generated this content."""
        quality_indicator = self._get_quality_indicator(metadata.quality_score)
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"Generated by {metadata.analyzer_name} | Quality: {metadata.quality_score:.2f} {quality_indicator}"
                    }
                }],
                "icon": {"type": "emoji", "emoji": "🤖"},
                "color": "blue_background"
            }
        }
    
    def _create_dashboard_header(self) -> Dict[str, Any]:
        """Create executive dashboard header."""
        return {
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"📊 Executive Intelligence Dashboard"},
                    "annotations": {"bold": True}
                }]
            }
        }
    
    def _create_metrics_callout(self, results: List[TrackedAnalyzerResult]) -> Dict[str, Any]:
        """Create a callout with key metrics from all analyses."""
        total_insights = sum(len(self._extract_insights(r.content)) for r in results)
        avg_quality = sum(r.metadata.quality_score for r in results) / len(results) if results else 0
        total_tokens = sum(r.metadata.token_usage.get("total_tokens", 0) for r in results)
        
        metrics_text = f"""
📈 Analysis Overview
• {len(results)} AI Analyzers Deployed
• {total_insights} Strategic Insights Generated  
• {avg_quality:.1%} Average Quality Score
• {total_tokens:,} Tokens Processed
• {sum(r.metadata.web_search_used for r in results)} Web Searches Performed
"""
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": metrics_text.strip()}}],
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "green_background"
            }
        }
    
    def _create_quality_overview(self, results: List[TrackedAnalyzerResult]) -> Dict[str, Any]:
        """Create visual quality overview."""
        quality_bars = []
        
        for result in results:
            score = result.metadata.quality_score
            bar_length = int(score * 10)
            bar = "█" * bar_length + "░" * (10 - bar_length)
            indicator = self._get_quality_indicator(score)
            
            quality_bars.append(
                f"{result.analyzer_name:<20} {bar} {score:.1%} {indicator}"
            )
            
        return {
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": "\n".join(quality_bars)}}],
                "language": "plain text"
            }
        }
    
    def _create_executive_columns(self, results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Create column layout for executive insights."""
        # Group results into columns (max 3 for readability)
        columns = []
        column_count = min(3, len(results))
        
        if column_count == 0:
            return []
            
        for i in range(column_count):
            column_results = results[i::column_count]
            column_blocks = []
            
            for result in column_results:
                # Extract key insight
                insights = self._extract_insights(result.content)
                if insights:
                    column_blocks.append({
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": f"💡 {insights[0][:100]}..."},
                                "annotations": {"italic": True}
                            }]
                        }
                    })
                    
            columns.append({"type": "column", "column": {"children": column_blocks}})
            
        return [{
            "type": "column_list",
            "column_list": {"children": columns}
        }]
    
    def _create_cross_insights(self, results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Create cross-analyzer insights section."""
        blocks = []
        
        # Find common themes
        all_text = " ".join(r.content for r in results)
        themes = self._extract_themes(all_text)
        
        if themes:
            blocks.append({
                "type": "heading_2", 
                "heading_2": {
                    "rich_text": [{"type": "text", "text": {"content": "🎯 Cross-Cutting Themes"}}]
                }
            })
            
            theme_list = []
            for theme, count in themes[:5]:  # Top 5 themes
                theme_list.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{
                            "type": "text",
                            "text": {"content": f"{theme} (mentioned {count}x)"}
                        }]
                    }
                })
            blocks.extend(theme_list)
            
        return blocks
    
    def _create_action_items_database(self, results: List[TrackedAnalyzerResult]) -> Dict[str, Any]:
        """Create inline database for action items."""
        # Extract all action items
        all_actions = []
        for result in results:
            actions = self._extract_action_items(result.content)
            for action in actions:
                all_actions.append({
                    "action": action,
                    "source": result.analyzer_name,
                    "priority": self._determine_priority(action)
                })
                
        # Create inline database representation
        action_blocks = []
        for action_data in sorted(all_actions, key=lambda x: x["priority"]):
            priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(action_data["priority"], "⚪")
            action_blocks.append({
                "type": "to_do",
                "to_do": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": f"{priority_emoji} {action_data['action']} [{action_data['source']}]"}
                    }],
                    "checked": False
                }
            })
            
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": f"⚡ Action Items ({len(all_actions)})"}}],
                "children": action_blocks[:10]  # Limit to 10 for readability
            }
        }
    
    def _format_with_mobile_optimization(self, content: str, content_type: str) -> List[Dict[str, Any]]:
        """Format content with mobile-friendly line lengths and structure."""
        blocks = []
        
        # Split content into sections
        sections = self._split_into_sections(content)
        
        for section in sections:
            # Wrap long lines
            wrapped_content = self._wrap_text(section["content"], self.mobile_line_length)
            
            # Create appropriate block type
            if section.get("is_list"):
                for item in wrapped_content.split("\n"):
                    if item.strip():
                        blocks.append({
                            "type": "bulleted_list_item",
                            "bulleted_list_item": {
                                "rich_text": [{"type": "text", "text": {"content": item.strip()}}]
                            }
                        })
            else:
                blocks.append({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": wrapped_content}}]
                    }
                })
                
        return blocks
    
    def _table_to_cards(self, table_block: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert table to mobile-friendly card layout."""
        cards = []
        
        # Extract table data (simplified for brevity)
        # In real implementation, would parse table structure
        
        cards.append({
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "📱 Table converted to cards for mobile viewing"}}],
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "gray_background"
            }
        })
        
        return cards
    
    def _add_toggle_preview(self, toggle_block: Dict[str, Any]) -> Dict[str, Any]:
        """Add preview text to toggle for mobile scanning."""
        if "children" in toggle_block.get("toggle", {}):
            # Extract first 80 chars of content as preview
            preview = self._extract_preview(toggle_block["toggle"]["children"])
            
            # Update toggle title with preview
            rich_text = toggle_block["toggle"]["rich_text"]
            if rich_text and preview:
                original = rich_text[0]["text"]["content"] 
                rich_text[0]["text"]["content"] = f"{original} — {preview}..."
                
        return toggle_block
    
    def _get_quality_indicator(self, score: float) -> str:
        """Get emoji indicator for quality score."""
        if score >= 0.9:
            return self.quality_indicators["excellent"]
        elif score >= 0.7:
            return self.quality_indicators["good"]
        elif score >= 0.5:
            return self.quality_indicators["acceptable"]
        else:
            return self.quality_indicators["poor"]
    
    def _extract_insights(self, content: str) -> List[str]:
        """Extract insights from content."""
        insights = []
        lines = content.split("\n")
        
        for line in lines:
            line = line.strip()
            # Look for bullet points or numbered items
            if re.match(r'^[•\-\*]\s+', line) or re.match(r'^\d+[.)]\s+', line):
                # Remove bullet/number and add
                clean_line = re.sub(r'^[•\-\*\d.)]+\s+', '', line)
                if clean_line and len(clean_line) > 20:  # Meaningful insight
                    insights.append(clean_line)
                    
        return insights
    
    def _extract_action_items(self, content: str) -> List[str]:
        """Extract action items from content."""
        action_keywords = ["should", "must", "need to", "recommend", "action:", "next step"]
        actions = []
        
        for line in content.split("\n"):
            if any(keyword in line.lower() for keyword in action_keywords):
                actions.append(line.strip())
                
        return actions
    
    def _extract_themes(self, text: str) -> List[Tuple[str, int]]:
        """Extract common themes from text."""
        # Simple keyword extraction (in production, use NLP)
        theme_keywords = {
            "AI/ML": ["ai", "machine learning", "ml", "neural", "model"],
            "Data": ["data", "analytics", "metrics", "insights"],
            "Security": ["security", "privacy", "protection", "secure"],
            "Performance": ["performance", "speed", "optimization", "efficiency"],
            "Innovation": ["innovation", "innovative", "novel", "breakthrough"],
            "Risk": ["risk", "threat", "vulnerability", "concern"],
            "Opportunity": ["opportunity", "potential", "growth", "expand"]
        }
        
        theme_counts = {}
        text_lower = text.lower()
        
        for theme, keywords in theme_keywords.items():
            count = sum(text_lower.count(keyword) for keyword in keywords)
            if count > 0:
                theme_counts[theme] = count
                
        return sorted(theme_counts.items(), key=lambda x: x[1], reverse=True)
    
    def _determine_priority(self, action: str) -> str:
        """Determine priority of an action item."""
        high_priority_words = ["urgent", "critical", "immediate", "asap", "must"]
        medium_priority_words = ["should", "important", "soon", "priority"]
        
        action_lower = action.lower()
        
        if any(word in action_lower for word in high_priority_words):
            return "high"
        elif any(word in action_lower for word in medium_priority_words):
            return "medium"
        else:
            return "low"
    
    def _split_into_sections(self, content: str) -> List[Dict[str, Any]]:
        """Split content into logical sections."""
        sections = []
        current_section = {"content": "", "is_list": False}
        
        for line in content.split("\n"):
            # Check if this is a list item
            is_list_item = bool(re.match(r'^[•\-\*\d.)]+\s+', line))
            
            if is_list_item != current_section["is_list"] and current_section["content"]:
                # Section type changed, save current
                sections.append(current_section)
                current_section = {"content": line, "is_list": is_list_item}
            else:
                # Continue current section
                if current_section["content"]:
                    current_section["content"] += "\n" + line
                else:
                    current_section["content"] = line
                current_section["is_list"] = is_list_item
                
        if current_section["content"]:
            sections.append(current_section)
            
        return sections
    
    def _wrap_text(self, text: str, max_length: int) -> str:
        """Wrap text to specified line length."""
        if not text:
            return ""
            
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            word_length = len(word)
            if current_length + word_length + 1 > max_length and current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
                current_length = word_length
            else:
                current_line.append(word)
                current_length += word_length + 1
                
        if current_line:
            lines.append(" ".join(current_line))
            
        return "\n".join(lines)
    
    def _extract_preview(self, blocks: List[Dict[str, Any]]) -> str:
        """Extract preview text from blocks."""
        preview_parts = []
        
        for block in blocks[:3]:  # First 3 blocks
            block_type = block.get("type")
            if block_type in ["paragraph", "bulleted_list_item", "numbered_list_item"]:
                rich_text = block.get(block_type, {}).get("rich_text", [])
                if rich_text:
                    text = rich_text[0].get("text", {}).get("content", "")
                    if text:
                        preview_parts.append(text[:50])
                        
        return " ".join(preview_parts)[:self.mobile_preview_length]
    
    def _create_section_header(self, result: TrackedAnalyzerResult) -> Dict[str, Any]:
        """Create section header with analyzer info."""
        quality_indicator = self._get_quality_indicator(result.metadata.quality_score)
        
        return {
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"{quality_indicator} {result.analyzer_name} Analysis"
                    },
                    "annotations": {"bold": True}
                }]
            }
        }
    
    def _create_prompt_config_callout(self, metadata: PromptMetadata) -> Dict[str, Any]:
        """Create callout showing prompt configuration."""
        config_text = f"""
🔧 Prompt Configuration
• Content Type: {metadata.content_type}
• Temperature: {metadata.temperature}
• Web Search: {"Enabled" if metadata.web_search_used else "Disabled"}
• Version: {metadata.prompt_version}
"""
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": config_text.strip()}}],
                "icon": {"type": "emoji", "emoji": "⚙️"},
                "color": "gray_background"
            }
        }
    
    def _create_citations_block(self, citations: List[Dict[str, str]]) -> Dict[str, Any]:
        """Create block for web citations."""
        citation_items = []
        
        for cite in citations:
            citation_items.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{
                        "type": "text",
                        "text": {
                            "content": f"{cite.get('title', 'Unknown')} - {cite.get('domain', '')}"
                        },
                        "href": cite.get('url')
                    }]
                }
            })
            
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": f"📚 Sources ({len(citations)})"}}],
                "children": citation_items
            }
        }
    
    def _create_performance_toggle(self, metadata: PromptMetadata) -> Dict[str, Any]:
        """Create toggle with performance metrics."""
        perf_text = f"""
⏱️ Performance Metrics
• Processing Time: {metadata.processing_time:.2f}s
• Tokens Used: {metadata.token_usage.get('total_tokens', 0):,}
• Quality Score: {metadata.quality_score:.2f}/1.00
• Confidence: {metadata.confidence_scores.get('overall', 0):.1%}
"""
        
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📊 Performance Details"}}],
                "children": [{
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": perf_text.strip()}}]
                    }
                }]
            }
        }
    
    def _create_quality_footer(self, metadata: PromptMetadata) -> Dict[str, Any]:
        """Create footer with quality summary."""
        return {
            "type": "divider",
            "divider": {}
        }
    
    def _format_executive_content(self, content: str, metadata: PromptMetadata) -> List[Dict[str, Any]]:
        """Format executive summary content."""
        blocks = []
        
        # Use blue background callout for executive summary
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": content}}],
                "icon": {"type": "emoji", "emoji": "📋"},
                "color": self.content_colors["executive_summary"]
            }
        })
        
        return blocks
    
    def _format_insights_content(self, content: str, metadata: PromptMetadata) -> List[Dict[str, Any]]:
        """Format insights content with visual hierarchy."""
        blocks = []
        insights = self._extract_insights(content)
        
        # Group insights by type
        immediate_actions = [i for i in insights if any(w in i.lower() for w in ["immediate", "urgent", "now"])]
        opportunities = [i for i in insights if any(w in i.lower() for w in ["opportunity", "potential", "growth"])]
        risks = [i for i in insights if any(w in i.lower() for w in ["risk", "threat", "concern"])]
        other = [i for i in insights if i not in immediate_actions + opportunities + risks]
        
        # Add sections with appropriate formatting
        if immediate_actions:
            blocks.append(self._create_insight_section("⚡ Immediate Actions", immediate_actions, "red_background"))
        if opportunities:
            blocks.append(self._create_insight_section("🚀 Opportunities", opportunities, "green_background"))
        if risks:
            blocks.append(self._create_insight_section("⚠️ Risks", risks, "yellow_background"))
        if other:
            blocks.append(self._create_insight_section("💡 Key Insights", other, "blue_background"))
            
        return blocks
    
    def _format_technical_content(self, content: str, metadata: PromptMetadata) -> List[Dict[str, Any]]:
        """Format technical analysis content."""
        blocks = []
        
        # Use code blocks for technical content
        blocks.append({
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": content}}],
                "language": "markdown"
            }
        })
        
        return blocks
    
    def _format_general_content(self, content: str, metadata: PromptMetadata) -> List[Dict[str, Any]]:
        """Format general content with standard formatting."""
        return self._format_with_mobile_optimization(content, "general")
    
    def _create_insight_section(self, title: str, insights: List[str], color: str) -> Dict[str, Any]:
        """Create a formatted insight section."""
        insight_blocks = []
        
        for insight in insights[:5]:  # Limit to 5 per section
            insight_blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": insight}}]
                }
            })
            
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": title}}],
                "children": insight_blocks,
                "color": color
            }
        }
    
    def _extract_all_insights(self, results: List[TrackedAnalyzerResult]) -> List[Dict[str, Any]]:
        """Extract all insights with their source information."""
        all_insights = []
        
        for result in results:
            insights = self._extract_insights(result.content)
            for insight in insights:
                all_insights.append({
                    "text": insight,
                    "source": result.analyzer_name,
                    "quality": result.metadata.quality_score
                })
                
        return all_insights
    
    def _group_similar_insights(self, insights: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group insights by similarity."""
        # Simple keyword-based grouping (in production, use embeddings)
        groups = {
            "Technical": [],
            "Business": [],
            "Risk Management": [],
            "Growth Opportunities": [],
            "Other": []
        }
        
        for insight in insights:
            text_lower = insight["text"].lower()
            
            if any(word in text_lower for word in ["technical", "api", "code", "system", "architecture"]):
                groups["Technical"].append(insight)
            elif any(word in text_lower for word in ["business", "revenue", "market", "customer"]):
                groups["Business"].append(insight)
            elif any(word in text_lower for word in ["risk", "threat", "security", "compliance"]):
                groups["Risk Management"].append(insight)
            elif any(word in text_lower for word in ["opportunity", "growth", "expand", "potential"]):
                groups["Growth Opportunities"].append(insight)
            else:
                groups["Other"].append(insight)
                
        # Remove empty groups
        return {k: v for k, v in groups.items() if v}
    
    def _create_insight_group_block(self, group_name: str, insights: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a block for grouped insights."""
        # Sort by quality score
        sorted_insights = sorted(insights, key=lambda x: x["quality"], reverse=True)
        
        insight_blocks = []
        for insight in sorted_insights[:3]:  # Top 3
            quality_indicator = self._get_quality_indicator(insight["quality"])
            insight_blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": f"{quality_indicator} {insight['text']} [{insight['source']}]"}
                    }]
                }
            })
            
        return {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": f"🔗 {group_name} ({len(insights)} insights)"}}],
                "children": insight_blocks
            }
        }
    
    def _columns_to_stack(self, column_list_block: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert column layout to stacked layout for mobile."""
        stacked_blocks = []
        
        # Extract columns and flatten
        columns = column_list_block.get("column_list", {}).get("children", [])
        for i, column in enumerate(columns):
            if i > 0:  # Add divider between columns
                stacked_blocks.append({"type": "divider", "divider": {}})
                
            column_children = column.get("column", {}).get("children", [])
            stacked_blocks.extend(column_children)
            
        return stacked_blocks
    
    def _optimize_text_block(self, block: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize text block for mobile reading."""
        block_type = block.get("type")
        if block_type in ["paragraph", "bulleted_list_item", "numbered_list_item"]:
            rich_text = block.get(block_type, {}).get("rich_text", [])
            if rich_text and rich_text[0].get("text"):
                original_text = rich_text[0]["text"]["content"]
                wrapped_text = self._wrap_text(original_text, self.mobile_line_length)
                rich_text[0]["text"]["content"] = wrapped_text
                
        return block