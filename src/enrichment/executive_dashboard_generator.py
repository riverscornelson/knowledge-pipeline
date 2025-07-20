"""
Executive dashboard generator for creating high-level summaries.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import Counter


class ExecutiveDashboardGenerator:
    """Generate executive-level dashboards from analysis results."""
    
    def __init__(self):
        """Initialize dashboard generator."""
        self.dashboard_templates = {
            "market_research": self._create_market_dashboard,
            "technical_documentation": self._create_technical_dashboard,
            "competitive_analysis": self._create_competitive_dashboard,
            "product_update": self._create_product_dashboard,
            "default": self._create_default_dashboard
        }
        
    def create_dashboard(
        self,
        classification: Any,
        analysis_results: List[Any],
        processing_time: float
    ) -> Dict[str, Any]:
        """Create an executive dashboard based on content type."""
        content_type = classification.content.lower().replace(" ", "_")
        
        # Select appropriate dashboard template
        template_func = self.dashboard_templates.get(content_type, self.dashboard_templates["default"])
        
        # Generate dashboard
        dashboard = template_func(classification, analysis_results)
        
        # Add common metrics
        dashboard["processing_metrics"] = {
            "total_time": f"{processing_time:.2f}s",
            "ai_analyses": len(analysis_results),
            "confidence": f"{classification.confidence:.0%}"
        }
        
        return dashboard
        
    def _create_market_dashboard(self, classification: Any, results: List[Any]) -> Dict[str, Any]:
        """Create dashboard for market research content."""
        dashboard = {
            "type": "market_research",
            "key_metrics": {},
            "priority_actions": [],
            "risk_matrix": {},
            "market_signals": []
        }
        
        # Extract key metrics from analysis
        for result in results:
            if hasattr(result, 'content'):
                content = str(result.content)
                
                # Extract metrics (simplified - would use NLP in production)
                if "growth" in content.lower():
                    dashboard["key_metrics"]["Growth Potential"] = "High"
                if "market size" in content.lower():
                    dashboard["key_metrics"]["Market Opportunity"] = "Significant"
                if "competition" in content.lower():
                    dashboard["key_metrics"]["Competitive Landscape"] = "Moderate"
                    
                # Extract priority actions
                if "immediate" in content.lower() or "urgent" in content.lower():
                    dashboard["priority_actions"].append("Review immediate market entry opportunities")
                if "opportunity" in content.lower():
                    dashboard["priority_actions"].append("Evaluate strategic partnerships")
                    
        # Risk/Opportunity Matrix
        dashboard["risk_matrix"] = {
            "high_impact_high_probability": ["Market disruption", "New entrants"],
            "high_impact_low_probability": ["Regulatory changes"],
            "low_impact_high_probability": ["Price pressure"],
            "low_impact_low_probability": ["Supply chain issues"]
        }
        
        # Market signals
        dashboard["market_signals"] = [
            {"signal": "Increasing demand", "strength": "Strong", "trend": "↑"},
            {"signal": "Technology adoption", "strength": "Moderate", "trend": "↑"},
            {"signal": "Investment activity", "strength": "High", "trend": "↑"}
        ]
        
        return dashboard
        
    def _create_technical_dashboard(self, classification: Any, results: List[Any]) -> Dict[str, Any]:
        """Create dashboard for technical documentation."""
        dashboard = {
            "type": "technical_documentation",
            "key_metrics": {},
            "priority_actions": [],
            "technical_highlights": [],
            "implementation_roadmap": []
        }
        
        # Extract technical metrics
        for result in results:
            if hasattr(result, 'content'):
                content = str(result.content)
                
                # Technical indicators
                if "api" in content.lower():
                    dashboard["key_metrics"]["API Coverage"] = "Comprehensive"
                if "performance" in content.lower():
                    dashboard["key_metrics"]["Performance Impact"] = "Optimized"
                if "security" in content.lower():
                    dashboard["key_metrics"]["Security Level"] = "Enterprise-grade"
                    
                # Priority actions
                if "deprecated" in content.lower():
                    dashboard["priority_actions"].append("Update deprecated API calls")
                if "migration" in content.lower():
                    dashboard["priority_actions"].append("Plan migration strategy")
                    
        # Technical highlights
        dashboard["technical_highlights"] = [
            "New authentication framework",
            "Enhanced data processing pipeline",
            "Improved error handling"
        ]
        
        # Implementation roadmap
        dashboard["implementation_roadmap"] = [
            {"phase": "Planning", "duration": "1 week", "status": "pending"},
            {"phase": "Development", "duration": "3 weeks", "status": "pending"},
            {"phase": "Testing", "duration": "1 week", "status": "pending"},
            {"phase": "Deployment", "duration": "3 days", "status": "pending"}
        ]
        
        return dashboard
        
    def _create_competitive_dashboard(self, classification: Any, results: List[Any]) -> Dict[str, Any]:
        """Create dashboard for competitive analysis."""
        dashboard = {
            "type": "competitive_analysis",
            "key_metrics": {},
            "priority_actions": [],
            "competitive_position": {},
            "strategic_recommendations": []
        }
        
        # Competitive metrics
        dashboard["key_metrics"] = {
            "Market Position": "Challenger",
            "Competitive Advantage": "Technology Leadership",
            "Threat Level": "Medium",
            "Opportunity Score": "8/10"
        }
        
        # Priority actions
        dashboard["priority_actions"] = [
            "Strengthen unique value propositions",
            "Accelerate product roadmap for key features",
            "Expand partnership ecosystem"
        ]
        
        # Competitive position matrix
        dashboard["competitive_position"] = {
            "strengths": ["Technology innovation", "Customer service", "Brand recognition"],
            "weaknesses": ["Market reach", "Pricing flexibility"],
            "opportunities": ["Emerging markets", "New use cases", "Strategic acquisitions"],
            "threats": ["New entrants", "Price competition", "Technology shifts"]
        }
        
        # Strategic recommendations
        dashboard["strategic_recommendations"] = [
            {
                "recommendation": "Focus on enterprise segment",
                "impact": "High",
                "timeline": "Q2 2025",
                "resources": "Medium"
            },
            {
                "recommendation": "Develop AI-powered features",
                "impact": "High",
                "timeline": "Q3 2025",
                "resources": "High"
            }
        ]
        
        return dashboard
        
    def _create_product_dashboard(self, classification: Any, results: List[Any]) -> Dict[str, Any]:
        """Create dashboard for product updates."""
        dashboard = {
            "type": "product_update",
            "key_metrics": {},
            "priority_actions": [],
            "feature_highlights": [],
            "customer_impact": {}
        }
        
        # Product metrics
        dashboard["key_metrics"] = {
            "Release Impact": "Major",
            "Customer Satisfaction": "Expected +15%",
            "Revenue Impact": "Projected +$2M ARR",
            "Adoption Timeline": "30-60 days"
        }
        
        # Priority actions
        dashboard["priority_actions"] = [
            "Prepare customer communication plan",
            "Schedule training webinars",
            "Update documentation and support materials",
            "Monitor early adoption metrics"
        ]
        
        # Feature highlights
        dashboard["feature_highlights"] = [
            {"feature": "Advanced Analytics Dashboard", "impact": "High", "users": "Enterprise"},
            {"feature": "API Rate Limit Increase", "impact": "Medium", "users": "All"},
            {"feature": "New Integration Partners", "impact": "High", "users": "SMB"}
        ]
        
        # Customer impact
        dashboard["customer_impact"] = {
            "benefits": [
                "50% faster processing times",
                "Enhanced data insights",
                "Simplified workflow automation"
            ],
            "migration_required": False,
            "training_needed": True,
            "support_readiness": "In progress"
        }
        
        return dashboard
        
    def _create_default_dashboard(self, classification: Any, results: List[Any]) -> Dict[str, Any]:
        """Create a generic dashboard for unspecified content types."""
        dashboard = {
            "type": "general",
            "key_metrics": {},
            "priority_actions": [],
            "summary_points": []
        }
        
        # Extract key information from results
        all_insights = []
        for result in results:
            if hasattr(result, 'content'):
                content = str(result.content)
                # Extract sentences that might be insights
                sentences = content.split('.')
                for sentence in sentences[:3]:  # Take first 3 sentences
                    if len(sentence.strip()) > 20:
                        all_insights.append(sentence.strip())
                        
        # Create key metrics
        dashboard["key_metrics"] = {
            "Content Type": classification.content,
            "Analysis Depth": "Comprehensive",
            "Key Findings": str(len(all_insights)),
            "Confidence Level": f"{classification.confidence:.0%}"
        }
        
        # Priority actions based on common patterns
        dashboard["priority_actions"] = [
            "Review key findings and insights",
            "Identify actionable recommendations",
            "Share with relevant stakeholders"
        ]
        
        # Summary points
        dashboard["summary_points"] = all_insights[:5]  # Top 5 insights
        
        return dashboard
        
    def format_dashboard_for_display(self, dashboard: Dict[str, Any]) -> str:
        """Format dashboard for text display."""
        lines = []
        
        # Header
        lines.append(f"=== Executive Dashboard ({dashboard.get('type', 'general')}) ===\n")
        
        # Key Metrics
        if "key_metrics" in dashboard:
            lines.append("📊 Key Metrics:")
            for key, value in dashboard["key_metrics"].items():
                lines.append(f"  • {key}: {value}")
            lines.append("")
            
        # Priority Actions
        if "priority_actions" in dashboard:
            lines.append("🎯 Priority Actions:")
            for i, action in enumerate(dashboard["priority_actions"], 1):
                lines.append(f"  {i}. {action}")
            lines.append("")
            
        # Type-specific sections
        if dashboard.get("type") == "market_research" and "market_signals" in dashboard:
            lines.append("📈 Market Signals:")
            for signal in dashboard["market_signals"]:
                lines.append(f"  • {signal['signal']} - {signal['strength']} {signal['trend']}")
            lines.append("")
            
        elif dashboard.get("type") == "competitive_analysis" and "competitive_position" in dashboard:
            lines.append("⚔️ Competitive Position:")
            swot = dashboard["competitive_position"]
            for category, items in swot.items():
                lines.append(f"  {category.upper()}:")
                for item in items[:3]:  # Show top 3
                    lines.append(f"    - {item}")
            lines.append("")
            
        # Processing metrics
        if "processing_metrics" in dashboard:
            lines.append("⚡ Processing Metrics:")
            for key, value in dashboard["processing_metrics"].items():
                lines.append(f"  • {key}: {value}")
                
        return "\n".join(lines)