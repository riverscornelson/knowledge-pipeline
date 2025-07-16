"""
Enhanced insights generator with prompt configuration and web search support.
"""
from typing import Optional, List, Dict, Any
from ..core.config import PipelineConfig
from ..core.prompt_config import PromptConfig
from .advanced_insights import AdvancedInsightsGenerator
from .base_analyzer import BaseAnalyzer


class EnhancedInsightsGenerator(BaseAnalyzer):
    """Enhanced insights generator that wraps existing functionality with new features."""
    
    @property
    def analyzer_name(self) -> str:
        """Override to match the config file which uses 'insights'."""
        return "insights"
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        """Initialize enhanced insights generator.
        
        Args:
            config: Pipeline configuration
            prompt_config: Optional prompt configuration
        """
        super().__init__(config, prompt_config)
        # Keep the existing generator for backward compatibility
        self.legacy_generator = AdvancedInsightsGenerator(config.openai)
    
    def generate_insights(self, content: str, title: str, content_type: Optional[str] = None) -> List[str]:
        """Generate insights with optional web search and content-type awareness.
        
        Args:
            content: The content to analyze
            title: Document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            List of insight strings
        """
        # Use the new analyze method
        result = self.analyze(content, title, content_type)
        
        if result.get("success"):
            # Parse insights from the analysis
            insights_text = result["analysis"]
            # Simple parsing - split by newlines and filter
            insights = [
                line.strip().lstrip("•-*123456789. ")
                for line in insights_text.split("\n")
                if line.strip() and not line.strip().startswith("#")
            ]
            return insights[:5]  # Return top 5 insights
        else:
            # Fallback to legacy generator
            return self.legacy_generator.generate_insights(content, title)
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for insights generation."""
        # Use full content - no arbitrary limits
        processed_content = content
        
        prompt = f"""
# Strategic Insights Analysis

**Document**: {title}

**Content**:
{processed_content}

---

Generate strategic insights following this structure:

1. **Immediate Actions**: What should be done right now?
2. **Strategic Opportunities**: What long-term advantages are revealed?
3. **Risk Factors**: What threats or challenges are identified?
4. **Market Implications**: How does this affect the competitive landscape?
5. **Innovation Potential**: What new possibilities does this enable?

Provide 3-5 actionable insights that a decision-maker can act upon.
Each insight should be:
- Specific and concrete (not vague)
- Action-oriented (starts with a verb)
- Strategic (not just a summary of facts)
- Relevant to business/technical decision-making

Format as a bulleted list with no more than 2 sentences per insight.
"""
        return prompt
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for insights generation."""
        return """You are a strategic analyst identifying actionable insights and opportunities.

Your expertise includes:
- Business strategy and competitive analysis
- Technology trends and implications
- Risk assessment and mitigation
- Innovation and growth opportunities

Focus on insights that drive decision-making and action, not just observations."""
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails."""
        return {
            "analysis": "• Unable to generate insights due to processing error\n• Manual review recommended",
            "success": False,
            "web_search_used": False
        }