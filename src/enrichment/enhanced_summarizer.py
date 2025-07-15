"""
Enhanced content summarizer with prompt configuration and web search support.
"""
from typing import Optional, Dict, Any
from ..core.config import OpenAIConfig, PipelineConfig
from ..core.prompt_config import PromptConfig
from .advanced_summarizer import AdvancedContentSummarizer
from .base_analyzer import BaseAnalyzer


class EnhancedContentSummarizer(BaseAnalyzer):
    """Enhanced summarizer that wraps existing functionality with new features."""
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        """Initialize enhanced summarizer.
        
        Args:
            config: Pipeline configuration
            prompt_config: Optional prompt configuration
        """
        super().__init__(config, prompt_config)
        # Keep the existing summarizer for backward compatibility
        self.legacy_summarizer = AdvancedContentSummarizer(config.openai)
    
    def generate_summary(self, content: str, title: str, content_type: Optional[str] = None) -> str:
        """Generate summary with optional web search and content-type awareness.
        
        Args:
            content: The content to summarize
            title: Document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            Summary text
        """
        # Use the new analyze method
        result = self.analyze(content, title, content_type)
        
        if result.get("success"):
            return result["analysis"]
        else:
            # Fallback to legacy summarizer
            return self.legacy_summarizer.generate_summary(content, title)
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for summarization."""
        # Use the advanced prompting structure from the original
        processed_content = self.legacy_summarizer._intelligent_preprocessing(content, max_chars=8000)
        
        prompt = f"""
# Document Analysis Request

**Title**: {title}

**Content**:
{processed_content}

---

Please provide a comprehensive summary following this structure:

## Executive Summary
Provide a 2-3 sentence overview capturing the document's primary purpose and key takeaway.

## Key Points
List the 3-5 most important points, facts, or findings.

## Strategic Implications
Identify actionable insights and their potential impact.

## Technical Details (if applicable)
Highlight any technical specifications, methodologies, or implementation details.

## Recommendations
Suggest concrete next steps based on the content.

Remember to:
- Prioritize actionable insights
- Use specific, quantitative language
- Structure by importance
- Preserve critical context
"""
        return prompt
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for summarization."""
        # Use the system prompt from config or fall back to the original
        return """You are an expert content analyst specializing in extracting actionable insights from complex documents. Your mission is to serve busy professionals who need to quickly understand and act on information.

EXPERTISE AREAS:
- Strategic business analysis
- Technical concept simplification  
- Risk and opportunity identification
- Decision-support synthesis

QUALITY STANDARDS:
- Prioritize actionable insights over background information
- Use specific, quantitative language (avoid vague terms)
- Structure information by importance and urgency
- Preserve critical context and nuance
- Enable informed decision-making"""
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails."""
        return {
            "analysis": f"Summary generation failed: {error_message}",
            "success": False,
            "web_search_used": False
        }