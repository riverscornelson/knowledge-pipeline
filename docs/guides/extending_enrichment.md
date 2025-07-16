# Extending Enrichment with Additional Analyzers

This document explains how to add new AI analysis types to the knowledge pipeline enrichment process.

## Current Implementation Status

### ✅ What's Fully Implemented

1. **Content-Type Aware Prompts** - The `config/prompts.yaml` system provides sophisticated prompt customization
2. **BaseAnalyzer Infrastructure** - Clean foundation for building new analyzers  
3. **TechnicalAnalyzer** - One complete example analyzer implementation
4. **PromptConfig System** - Runtime configuration with environment variable overrides

### 🚧 Extension Points Available

- **Custom analyzer prompts** configured in `config/prompts.yaml` 
- **BaseAnalyzer infrastructure** ready for new analyzer implementations
- **Environment variable patterns** established for analyzer control

## How the System Currently Works

### 1. Content-Type Aware Processing

When content is processed, the system:

1. **Detects content type** (Research, Vendor Capability, Market News, etc.)
2. **Loads appropriate prompts** from `config/prompts.yaml`
3. **Applies content-specific analysis** with specialized system prompts
4. **Uses web search** based on content type configuration

### 2. Available Content Types

The system has sophisticated prompts for:

- **Research** - Academic papers with methodology focus
- **Vendor Capability** - Product features with competitive analysis  
- **Market News** - Financial implications and strategic moves
- **Thought Leadership** - Strategic vision and industry implications
- **Client Deliverable** - Recommendations and outcomes
- **Personal Note** - Action items and decisions
- **Email** - Communication analysis
- **Website** - Content credibility and messaging
- **PDF** - Generic document analysis

### 3. Web Search Integration

Each content type configures whether web search enhances analysis:

```yaml
# Research benefits from recent citations
research:
  summarizer:
    web_search: true
    
# Client deliverables should stay confidential  
client_deliverable:
  summarizer:
    web_search: false
```

## Adding a New Analyzer (Step-by-Step)

### Step 1: Create the Analyzer Class

```python
# src/enrichment/custom_analyzer.py
from typing import Dict, Any, Optional
from ..core.config import PipelineConfig
from ..core.prompt_config import PromptConfig
from .base_analyzer import BaseAnalyzer

class CustomAnalyzer(BaseAnalyzer):
    """Template for creating custom analyzers."""
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        super().__init__(config, prompt_config)
        self.analyzer_name = "custom"  # Match your config key
        
        # Get custom prompt from config/prompts.yaml
        custom_prompt = self.prompt_config.get_custom_analyzer_prompt("custom")
        self.default_prompt_template = custom_prompt or """Analyze this content:
        
Title: {title}
Content: {content}

Focus on:
1. Your specific analysis needs
2. Domain-specific insights  
3. Actionable recommendations
4. Key findings
"""

    def _get_default_system_prompt(self) -> str:
        return "You are a specialist analyst focused on [your domain]."
        
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        return {
            "analysis": f"Custom analysis failed: {error_message}",
            "toggle_title": "🔍 Custom Analysis",
            "success": False
        }
```

### Step 2: Add Environment Control

```bash
# .env file
ENABLE_CUSTOM_ANALYSIS=true
CUSTOM_ANALYZER_WEB_SEARCH=true
```

### Step 3: Register in Pipeline

```python
# src/enrichment/pipeline_processor.py
from .custom_analyzer import CustomAnalyzer

# In __init__ method:
if self.prompt_config.is_analyzer_enabled("custom"):
    self.custom_analyzer = CustomAnalyzer(config, prompt_config)
    
# In process_content method:
if hasattr(self, 'custom_analyzer'):
    custom_analysis = self.custom_analyzer.process(content, title, content_type)
    if custom_analysis["success"]:
        analysis_blocks.append(custom_analysis)
```

### Step 4: Test the Analyzer

```python
# Test script
from src.core.config import PipelineConfig
from src.core.prompt_config import PromptConfig
from src.enrichment.custom_analyzer import CustomAnalyzer

config = PipelineConfig.from_env()
prompt_config = PromptConfig()
analyzer = CustomAnalyzer(config, prompt_config)

result = analyzer.process(
    content="Your test content here...",
    title="Test Document",
    content_type="Research"  # Or your target content type
)
print(result["analysis"])
```

## Customizing Prompts

The `config/prompts.yaml` file provides powerful customization:

### Content-Type Specific Prompts

```yaml
content_types:
  research:
    # Different system prompt for research content
    summarizer:
      system: |
        You are an academic research analyst focusing on:
        - Methodology evaluation
        - Statistical significance  
        - Research impact
      web_search: true  # Check for recent citations
      
    # Custom analyzer gets different behavior for research
    custom_analyzer:
      web_search: true  # For implementation details
```

### Environment Variable Integration

```yaml
analyzers:
  custom:
    enabled: "${ENABLE_CUSTOM_ANALYSIS}"
    web_search: "${CUSTOM_ANALYZER_WEB_SEARCH}"
    default_prompt: |
      Your custom prompt template here...
```

## Architecture Benefits

### 🎯 **Content-Aware**
- Different analysis for research papers vs marketing content
- Web search enabled only when it adds value
- Specialized system prompts for each domain

### 💰 **Cost-Effective**  
- Only run analyzers you need via environment variables
- Web search only when configured (saves API costs)
- Content-type awareness reduces irrelevant analysis

### 🚀 **Extensible**
- BaseAnalyzer provides consistent interface
- PromptConfig handles all customization
- No code changes needed for prompt updates

### 🔧 **Maintainable**
- Each analyzer is self-contained
- Configuration separate from code
- Environment variable control for easy deployment

## Real Example

**Input**: "Microsoft Copilot for Office 365 - New Enterprise Features"
**Content Type**: "Vendor Capability"

**Current System** (working):
- ✅ Summarizer uses vendor-focused system prompt  
- ✅ Classifier identifies vendor and capabilities
- ✅ Insights focus on enterprise implications
- ✅ Web search enabled for competitive context

**With Custom Analyzer** (after implementation):
- ✅ All of the above PLUS...
- ✅ Domain-specific analysis based on your needs
- ✅ Specialized insights for your use case
- ✅ Custom output format and focus areas

## Next Steps

1. **Create custom analyzers** - Follow the pattern established by TechnicalAnalyzer
2. **Integrate with pipeline** - Add analyzer registration and execution
3. **Test thoroughly** - Ensure analyzers work with all content types
4. **Extend prompts** - Add new content types and analyzer configurations

The foundation is solid - the prompt configuration system is sophisticated and ready for extension!