# Extending Enrichment with Additional Analyzers

This document explains how to add new AI analysis types to the knowledge pipeline enrichment process.

## Quick Start

### 1. Create a New Analyzer

Create a new file in `src/enrichment/` following this pattern:

```python
# src/enrichment/market_analyzer.py
from typing import Dict, Any
from openai import OpenAI
from ..core.config import PipelineConfig
from ..utils.logging import setup_logger


class MarketAnalyzer:
    """Analyzes market and business aspects of content."""
    
    def __init__(self, config: PipelineConfig):
        self.config = config.openai
        self.client = OpenAI(api_key=config.openai.api_key)
        self.logger = setup_logger(__name__)
        
    def analyze(self, content: str, title: str) -> Dict[str, Any]:
        """Perform market analysis on content."""
        try:
            prompt = f"""Analyze the market and business implications of this content:

Title: {title}
Content: {content[:8000]}

Focus on:
1. Market opportunities and threats
2. Competitive landscape mentions
3. Business model implications
4. Industry trends

Format as markdown with clear sections."""

            completion = self.client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are a business analyst specializing in market research and competitive intelligence."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            
            return {
                "analysis": completion.choices[0].message.content,
                "toggle_title": "📊 Market Analysis",
                "success": True
            }
            
        except Exception as e:
            self.logger.error(f"Market analysis failed: {e}")
            return {
                "analysis": "Market analysis failed",
                "toggle_title": "📊 Market Analysis",
                "success": False
            }
```

### 2. Register the Analyzer

Add it to `pipeline_processor.py` in the `__init__` method:

```python
# In src/enrichment/pipeline_processor.py
from .market_analyzer import MarketAnalyzer

# In __init__ method:
if os.getenv("ENABLE_MARKET_ANALYSIS", "").lower() == "true":
    self.additional_analyzers.append(MarketAnalyzer(config))
```

### 3. Enable via Environment Variable

```bash
# In .env file
ENABLE_MARKET_ANALYSIS=true
```

## How It Works

1. **Initialization**: When `PipelineProcessor` starts, it checks environment variables and initializes enabled analyzers
2. **Processing**: During enrichment, each analyzer's `analyze()` method is called with the content
3. **Storage**: Results are automatically stored as toggle blocks in Notion

## Analyzer Requirements

Each analyzer must:
- Have an `analyze(content: str, title: str)` method
- Return a dict with:
  - `analysis`: The markdown-formatted analysis text
  - `toggle_title`: The title for the Notion toggle block (with emoji)
  - `success`: Boolean indicating if analysis succeeded
- Handle errors gracefully and return a failure dict

## Available Analyzers

### Market Analyzer (example above)
- Market opportunities
- Competitive landscape
- Business implications
- Industry trends

## Best Practices

1. **Token Limits**: Truncate content to ~8000 chars to stay within token limits
2. **Error Handling**: Always catch exceptions and return a failure result
3. **Markdown Output**: Format analysis as markdown for better Notion rendering
4. **System Prompts**: Use specific system prompts to guide the AI's expertise
5. **Temperature**: Use low temperature (0.3) for consistent, factual analysis

## Customizing Prompts

The pipeline now supports comprehensive prompt customization through the `config/prompts.yaml` file. This allows you to tailor AI analysis for different content types without modifying code.

### Configuration Structure

```yaml
# config/prompts.yaml
global:
  web_search_enabled: true  # Enable web search globally

content_types:
  Research:
    prompts:
      summarizer: |
        You are analyzing a research document. Focus on:
        - Key findings and methodologies
        - Statistical significance
        - Practical applications
        
        Title: {title}
        Content: {content}
      insights: |
        Extract actionable research insights...
    web_search_enabled: false  # Disable for this content type
    
  "Vendor Capability":
    prompts:
      summarizer: |
        Analyze this vendor's capabilities focusing on:
        - Core features and differentiators
        - Integration requirements
        - Pricing and licensing model
        
additional_analyzers:
  technical:
    enabled: true
    prompt: |
      Perform deep technical analysis...
```

### Using the Base Analyzer

For new analyzers, inherit from `BaseAnalyzer` to automatically get prompt configuration support:

```python
# src/enrichment/market_analyzer.py
from .base_analyzer import BaseAnalyzer

class MarketAnalyzer(BaseAnalyzer):
    """Market and business analysis."""
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        # Config contains web_search_enabled and other settings
        return f"Analyze market implications of '{title}'..."
    
    def _get_default_system_prompt(self) -> str:
        return "You are a market analyst..."
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        return {
            "analysis": f"Market analysis failed: {error_message}",
            "toggle_title": "📊 Market Analysis",
            "success": False
        }
```

### Registering Custom Prompts

1. Add to `config/prompts.yaml`:
```yaml
additional_analyzers:
  market:
    enabled: true
    prompt: |
      Analyze market dynamics and business implications...
```

2. The analyzer automatically uses the custom prompt if available.

### Content-Type Specific Behavior

Different content types can have entirely different analysis approaches:

```yaml
content_types:
  "Technical Guide":
    prompts:
      summarizer: |
        Create a technical summary with code examples...
      insights: |
        Extract implementation patterns and best practices...
        
  "Market News":
    prompts:
      summarizer: |
        Summarize market movements and implications...
      insights: |
        Identify trading opportunities and risks...
    web_search_enabled: true  # Enable real-time data lookup
```

### Dynamic Feature Control

Enable/disable capabilities per content type:

```yaml
content_types:
  Research:
    web_search_enabled: false  # Don't search for academic papers
    
  "Market News":
    web_search_enabled: true   # Get latest market data
    
  "Client Deliverable":
    additional_analyzers:
      technical:
        enabled: false  # Skip technical analysis for deliverables
```

### Model Configuration

The pipeline uses different models for different purposes:

**Standard Analysis Models** (via Chat Completions API):
- `MODEL_SUMMARY=gpt-4.1` - For content summarization
- `MODEL_CLASSIFIER=gpt-4.1-mini` - For efficient classification
- `MODEL_INSIGHTS=gpt-4.1` - For deep insights generation

**Web Search Model** (via Responses API):
- `WEB_SEARCH_MODEL=o3` - Used only when web search is enabled

The appropriate model is automatically selected based on the analyzer and whether web search is enabled.

### Best Practices for Custom Prompts

1. **Use Placeholders**: Always include `{title}` and `{content}` placeholders
2. **Be Specific**: Tailor prompts to the content type's unique needs
3. **Set Boundaries**: Specify what to focus on and what to ignore
4. **Format Instructions**: Request specific output formats (markdown, sections, etc.)
5. **Token Awareness**: Keep prompts concise to leave room for content

### Testing Custom Prompts

Test your prompts with specific content types:

```python
# Test script
from src.core.prompt_config import PromptConfig

config = PromptConfig()
prompt = config.get_prompt("summarizer", "Research")
print(f"Research summarizer prompt:\n{prompt}")
```

### Hot Reloading

Changes to `config/prompts.yaml` are loaded on each pipeline run, allowing rapid iteration without code changes or restarts.