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
ENABLE_TECHNICAL_ANALYSIS=true
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

### Technical Analyzer (`ENABLE_TECHNICAL_ANALYSIS`)
- Technologies and frameworks
- Architecture patterns
- Implementation considerations
- Technical complexity

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

## Future Extensions

To add prompt customization via config files:

```python
# In analyzer __init__:
self.prompt_template = config.get(
    f"prompts.{self.__class__.__name__.lower()}", 
    self.default_prompt_template
)
```

This allows overriding prompts via environment variables or config files without code changes.