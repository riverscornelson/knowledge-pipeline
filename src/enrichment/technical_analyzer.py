"""Technical analysis for knowledge content."""

from typing import Dict, Any, Optional
from core.config import PipelineConfig
from core.prompt_config import PromptConfig
from .base_analyzer import BaseAnalyzer


class TechnicalAnalyzer(BaseAnalyzer):
    """Analyzes technical aspects of content."""
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        super().__init__(config, prompt_config)
        
        # Get custom prompt if available
        custom_prompt = self.prompt_config.get_custom_analyzer_prompt("technical")
        self.default_prompt_template = custom_prompt or """Analyze the technical aspects of this content:

Title: {title}
Content: {content}

Provide a structured analysis of:
1. Technologies and frameworks mentioned (with versions where specified)
2. Architecture patterns or design approaches
3. Implementation considerations and best practices
4. Security implications
5. Performance and scalability aspects

Format as markdown with clear sections and bullet points."""
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for technical analysis."""
        return self.default_prompt_template.format(
            title=title,
            content=content  # Use full content
        )
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for technical analysis."""
        return "You are a technical analyst specializing in software architecture, technology stacks, and implementation patterns."
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails."""
        return {
            "analysis": f"Technical analysis failed: {error_message}",
            "toggle_title": "🔧 Technical Analysis",
            "success": False,
            "web_search_used": False
        }
    
    def analyze(self, content: str, title: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Perform technical analysis on content."""
        result = super().analyze(content, title, content_type)
        
        # Add toggle title to result
        if result.get("success"):
            result["toggle_title"] = "🔧 Technical Analysis"
        
        return result