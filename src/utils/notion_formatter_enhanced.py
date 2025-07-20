"""
Enhanced Notion formatter with prompt attribution support.
"""
from typing import List, Dict, Any, Optional
from .notion_formatter import NotionFormatter


class NotionFormatterEnhanced(NotionFormatter):
    """Enhanced formatter with attribution and executive dashboard support."""
    
    def __init__(self):
        """Initialize enhanced formatter."""
        super().__init__()
        
        # Additional emojis for attribution
        self.attribution_emojis = {
            "excellent": "⭐⭐⭐⭐⭐",
            "good": "⭐⭐⭐⭐",
            "fair": "⭐⭐⭐",
            "needs_improvement": "⭐⭐",
            "insufficient_data": "⭐"
        }
        
    def format_executive_dashboard(self, dashboard: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format executive dashboard into rich Notion blocks."""
        blocks = []
        
        # Dashboard header with type
        dashboard_type = dashboard.get("type", "general").replace("_", " ").title()
        blocks.append(self._create_heading_block(
            f"📊 Executive Dashboard - {dashboard_type}",
            level=1
        ))
        
        # Key metrics as cards
        if "key_metrics" in dashboard:
            blocks.extend(self._format_metric_cards(dashboard["key_metrics"]))
            
        # Priority actions as checklist
        if "priority_actions" in dashboard:
            blocks.append(self._create_heading_block("🎯 Priority Actions", level=2))
            blocks.extend(self._format_action_checklist(dashboard["priority_actions"]))
            
        # Risk/Opportunity Matrix
        if "risk_matrix" in dashboard:
            blocks.append(self._create_heading_block("⚖️ Risk/Opportunity Analysis", level=2))
            blocks.extend(self._format_risk_matrix(dashboard["risk_matrix"]))
            
        # Market signals (for market research)
        if "market_signals" in dashboard:
            blocks.append(self._create_heading_block("📈 Market Signals", level=2))
            blocks.extend(self._format_market_signals(dashboard["market_signals"]))
            
        # Competitive position (for competitive analysis)
        if "competitive_position" in dashboard:
            blocks.append(self._create_heading_block("⚔️ SWOT Analysis", level=2))
            blocks.extend(self._format_swot_analysis(dashboard["competitive_position"]))
            
        # Strategic recommendations
        if "strategic_recommendations" in dashboard:
            blocks.append(self._create_heading_block("🔮 Strategic Recommendations", level=2))
            blocks.extend(self._format_recommendations(dashboard["strategic_recommendations"]))
            
        return blocks
        
    def format_attributed_analysis(
        self,
        content: str,
        prompt_name: str,
        version: str,
        quality_score: float,
        processing_time: float,
        web_sources: Optional[List[Dict]] = None
    ) -> List[Dict[str, Any]]:
        """Format analysis with full attribution details."""
        blocks = []
        
        # Header with attribution
        quality_stars = self._get_quality_stars(quality_score)
        header = f"{prompt_name} v{version} {quality_stars}"
        
        # Create toggle for the analysis
        analysis_blocks = self.format_content(content)
        
        # Add attribution footer
        attribution_text = f"\n📊 Quality: {quality_score:.2f}/5.0 | ⏱️ Processing: {processing_time:.2f}s"
        if web_sources:
            attribution_text += f" | 🔍 Web Sources: {len(web_sources)}"
            
        analysis_blocks.append(self._create_paragraph_block(attribution_text))
        
        # Web citations if present
        if web_sources:
            analysis_blocks.extend(self._format_web_citations(web_sources))
            
        # Wrap in toggle
        toggle_block = self._create_toggle_block(header, analysis_blocks)
        blocks.append(toggle_block)
        
        return blocks
        
    def format_prompt_performance_table(self, performance_data: List[Dict]) -> List[Dict[str, Any]]:
        """Format prompt performance data as a rich table."""
        blocks = []
        
        blocks.append(self._create_heading_block("📈 Prompt Performance Metrics", level=2))
        
        # Create performance table
        headers = ["Prompt", "Version", "Quality", "Uses", "Avg Time", "Health"]
        rows = []
        
        for data in performance_data:
            health_emoji = self._get_health_emoji(data.get("health", "unknown"))
            rows.append([
                data.get("prompt", "Unknown"),
                data.get("version", "0.0"),
                data.get("quality", "N/A"),
                data.get("uses", "0"),
                data.get("time", "N/A"),
                health_emoji
            ])
            
        blocks.append(self._create_table_block(headers, rows))
        
        # Add feedback prompt
        blocks.append(self._create_callout_block(
            "💭 How would you rate the quality of these AI analyses? Your feedback helps improve prompt performance.",
            icon="💭",
            color="purple_background"
        ))
        
        return blocks
        
    def _format_metric_cards(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format key metrics as visual cards."""
        blocks = []
        
        # Group metrics into cards (2-3 per row for visual balance)
        metric_items = list(metrics.items())
        
        for i in range(0, len(metric_items), 3):
            card_group = metric_items[i:i+3]
            
            # Create a callout for each group
            card_content = []
            for key, value in card_group:
                # Determine emoji based on metric name
                emoji = self._get_metric_emoji(key)
                card_content.append(f"{emoji} **{key}**: {value}")
                
            blocks.append(self._create_callout_block(
                "\n".join(card_content),
                icon="📊",
                color="blue_background"
            ))
            
        return blocks
        
    def _format_action_checklist(self, actions: List[str]) -> List[Dict[str, Any]]:
        """Format priority actions as an interactive checklist."""
        blocks = []
        
        for action in actions:
            blocks.append({
                "type": "to_do",
                "to_do": {
                    "rich_text": self._parse_inline_formatting(action),
                    "checked": False
                }
            })
            
        return blocks
        
    def _format_risk_matrix(self, matrix: Dict) -> List[Dict[str, Any]]:
        """Format risk/opportunity matrix as a structured view."""
        blocks = []
        
        # Create quadrants
        quadrants = [
            ("🔴 High Impact / High Probability", matrix.get("high_impact_high_probability", [])),
            ("🟡 High Impact / Low Probability", matrix.get("high_impact_low_probability", [])),
            ("🟢 Low Impact / High Probability", matrix.get("low_impact_high_probability", [])),
            ("⚪ Low Impact / Low Probability", matrix.get("low_impact_low_probability", []))
        ]
        
        for title, items in quadrants:
            if items:
                blocks.append(self._create_heading_block(title, level=3))
                item_list = [{"text": item, "children": []} for item in items]
                blocks.extend(self._create_list_block(item_list))
                
        return blocks
        
    def _format_market_signals(self, signals: List[Dict]) -> List[Dict[str, Any]]:
        """Format market signals as a visual table."""
        blocks = []
        
        headers = ["Signal", "Strength", "Trend", "Impact"]
        rows = []
        
        for signal in signals:
            trend_emoji = signal.get("trend", "→")
            impact = self._get_impact_level(signal.get("strength", ""))
            rows.append([
                signal.get("signal", "Unknown"),
                signal.get("strength", "N/A"),
                trend_emoji,
                impact
            ])
            
        blocks.append(self._create_table_block(headers, rows))
        
        return blocks
        
    def _format_swot_analysis(self, swot: Dict) -> List[Dict[str, Any]]:
        """Format SWOT analysis as a structured view."""
        blocks = []
        
        categories = [
            ("💪 Strengths", swot.get("strengths", [])),
            ("🚧 Weaknesses", swot.get("weaknesses", [])),
            ("🚀 Opportunities", swot.get("opportunities", [])),
            ("⚠️ Threats", swot.get("threats", []))
        ]
        
        for title, items in categories:
            if items:
                blocks.append(self._create_heading_block(title, level=3))
                item_list = [{"text": item, "children": []} for item in items[:5]]  # Limit to 5
                blocks.extend(self._create_list_block(item_list))
                
        return blocks
        
    def _format_recommendations(self, recommendations: List[Dict]) -> List[Dict[str, Any]]:
        """Format strategic recommendations as cards."""
        blocks = []
        
        for rec in recommendations:
            # Create a rich recommendation card
            content = f"**{rec.get('recommendation', 'Unknown')}**\n"
            content += f"Impact: {rec.get('impact', 'N/A')} | "
            content += f"Timeline: {rec.get('timeline', 'N/A')} | "
            content += f"Resources: {rec.get('resources', 'N/A')}"
            
            color = "green_background" if rec.get("impact") == "High" else "blue_background"
            blocks.append(self._create_callout_block(content, icon="🎯", color=color))
            
        return blocks
        
    def _format_web_citations(self, citations: List[Dict]) -> List[Dict[str, Any]]:
        """Format web citations as a clean list."""
        blocks = []
        
        blocks.append(self._create_divider_block())
        blocks.append(self._create_heading_block("🔍 Web Sources", level=3))
        
        citation_items = []
        for citation in citations:
            title = citation.get("title", "Unknown")
            url = citation.get("url", "")
            domain = citation.get("domain", "")
            
            if url:
                text = f"[{title}]({url}) - {domain}"
            else:
                text = f"{title} - {domain}"
                
            citation_items.append({"text": text, "children": []})
            
        blocks.extend(self._create_list_block(citation_items))
        
        return blocks
        
    def _get_quality_stars(self, score: float) -> str:
        """Convert quality score to star rating."""
        if score >= 4.5:
            return "⭐⭐⭐⭐⭐"
        elif score >= 3.5:
            return "⭐⭐⭐⭐"
        elif score >= 2.5:
            return "⭐⭐⭐"
        elif score >= 1.5:
            return "⭐⭐"
        else:
            return "⭐"
            
    def _get_health_emoji(self, health: str) -> str:
        """Get emoji for health status."""
        health_map = {
            "excellent": "💚",
            "good": "🟢",
            "fair": "🟡",
            "needs_improvement": "🔴",
            "insufficient_data": "⚪",
            "unknown": "❓"
        }
        return health_map.get(health, "❓")
        
    def _get_metric_emoji(self, metric_name: str) -> str:
        """Get appropriate emoji for metric type."""
        metric_lower = metric_name.lower()
        
        if any(word in metric_lower for word in ["growth", "increase", "up"]):
            return "📈"
        elif any(word in metric_lower for word in ["decrease", "down", "decline"]):
            return "📉"
        elif any(word in metric_lower for word in ["revenue", "profit", "money", "cost"]):
            return "💰"
        elif any(word in metric_lower for word in ["user", "customer", "client"]):
            return "👥"
        elif any(word in metric_lower for word in ["time", "duration", "speed"]):
            return "⏱️"
        elif any(word in metric_lower for word in ["quality", "satisfaction", "rating"]):
            return "⭐"
        elif any(word in metric_lower for word in ["risk", "threat", "warning"]):
            return "⚠️"
        else:
            return "📊"
            
    def _get_impact_level(self, strength: str) -> str:
        """Convert strength to impact level with emoji."""
        strength_lower = strength.lower()
        
        if "strong" in strength_lower or "high" in strength_lower:
            return "🔴 High"
        elif "moderate" in strength_lower or "medium" in strength_lower:
            return "🟡 Medium"
        elif "weak" in strength_lower or "low" in strength_lower:
            return "🟢 Low"
        else:
            return "⚪ Unknown"