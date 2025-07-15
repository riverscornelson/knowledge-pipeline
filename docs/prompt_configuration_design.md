# Prompt Configuration Design with Web Search Support

## Overview

This design enables:
1. Content-type-specific prompts
2. Web search toggle per prompt/analyzer
3. Configuration via .env files
4. Backward compatibility with existing system

## Configuration Structure

### Environment Variables (.env)

```bash
# Global Web Search Settings
ENABLE_WEB_SEARCH=true                    # Master switch for web search
WEB_SEARCH_MODEL=gpt-4o                   # Model to use when web search is enabled

# Analyzer-Specific Web Search
SUMMARIZER_WEB_SEARCH=false               # Core summarizer doesn't need web search
CLASSIFIER_WEB_SEARCH=false               # Classification based on content only
INSIGHTS_WEB_SEARCH=true                  # Insights benefit from current context
TECHNICAL_ANALYZER_WEB_SEARCH=true        # Tech stack changes rapidly
MARKET_ANALYZER_WEB_SEARCH=true           # Market data needs to be current

# Content-Type Prompt Overrides
PROMPT_RESEARCH_PAPER_FOCUS=academic,methodology,citations
PROMPT_MARKET_NEWS_FOCUS=competitors,pricing,trends
PROMPT_TECHNICAL_DOC_FOCUS=implementation,architecture,dependencies
```

### Prompt Configuration File (prompts.yaml)

```yaml
# Default prompts for all content types
defaults:
  summarizer:
    system: "You are an expert content analyst..."
    temperature: 0.3
    web_search: false
    
  classifier:
    system: "You are a classification expert..."
    temperature: 0.1
    web_search: false
    
  insights:
    system: "You are a strategic analyst..."
    temperature: 0.6
    web_search: true

# Content-type specific overrides
content_types:
  research_paper:
    summarizer:
      system: |
        You are an academic research analyst specializing in:
        - Methodology evaluation
        - Citation analysis
        - Research impact assessment
      web_search: true  # Check for recent citations
      
  market_news:
    insights:
      system: |
        You are a market intelligence analyst. Focus on:
        - Competitive positioning
        - Market trends
        - Financial implications
      web_search: true  # Essential for current market data
      
  technical_documentation:
    technical_analyzer:
      system: |
        You are a senior software architect. Analyze:
        - Technology stack with version specifics
        - Security implications
        - Integration patterns
      web_search: true  # Check for latest versions/CVEs

# Custom analyzers
analyzers:
  technical:
    enabled: "${ENABLE_TECHNICAL_ANALYSIS}"
    web_search: "${TECHNICAL_ANALYZER_WEB_SEARCH}"
    prompts:
      default: |
        Analyze technical aspects...
      
  market:
    enabled: "${ENABLE_MARKET_ANALYSIS}"
    web_search: "${MARKET_ANALYZER_WEB_SEARCH}"
    prompts:
      default: |
        Analyze market implications...
```

## Implementation Code

### 1. Enhanced Config Loader

```python
# src/core/prompt_config.py
import os
import yaml
from typing import Dict, Any, Optional
from pathlib import Path

class PromptConfig:
    """Manages prompt configuration with content-type awareness and web search."""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path("config/prompts.yaml")
        self.prompts = self._load_prompts()
        self.web_search_enabled = os.getenv("ENABLE_WEB_SEARCH", "false").lower() == "true"
        
    def _load_prompts(self) -> Dict[str, Any]:
        """Load prompts from YAML with environment variable substitution."""
        if self.config_path.exists():
            with open(self.config_path) as f:
                content = f.read()
                # Substitute environment variables
                content = os.path.expandvars(content)
                return yaml.safe_load(content)
        return {}
    
    def get_prompt(self, analyzer: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Get prompt configuration for analyzer and content type."""
        # Start with defaults
        config = self.prompts.get("defaults", {}).get(analyzer, {}).copy()
        
        # Apply content-type overrides if available
        if content_type and "content_types" in self.prompts:
            content_config = self.prompts["content_types"].get(content_type, {}).get(analyzer, {})
            config.update(content_config)
        
        # Apply environment variable overrides
        env_web_search = os.getenv(f"{analyzer.upper()}_WEB_SEARCH")
        if env_web_search:
            config["web_search"] = env_web_search.lower() == "true"
        
        return config
```

### 2. Enhanced Analyzer Base Class

```python
# src/enrichment/base_analyzer.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from openai import OpenAI
from ..core.config import PipelineConfig
from ..core.prompt_config import PromptConfig

class BaseAnalyzer(ABC):
    """Base class with prompt configuration and web search support."""
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        self.config = config
        self.prompt_config = prompt_config or PromptConfig()
        self.client = OpenAI(api_key=config.openai.api_key)
        
    def analyze(self, content: str, title: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Analyze content with appropriate prompts and web search."""
        # Get configuration for this analyzer and content type
        analyzer_name = self.__class__.__name__.lower().replace("analyzer", "")
        prompt_config = self.prompt_config.get_prompt(analyzer_name, content_type)
        
        # Determine if we should use web search
        use_web_search = (
            self.prompt_config.web_search_enabled and 
            prompt_config.get("web_search", False)
        )
        
        # Build the API call
        if use_web_search and hasattr(self.client, 'responses'):
            # Use Responses API with web search
            return self._analyze_with_web_search(content, title, prompt_config)
        else:
            # Use standard Chat Completions API
            return self._analyze_standard(content, title, prompt_config)
    
    def _analyze_with_web_search(self, content: str, title: str, config: Dict) -> Dict[str, Any]:
        """Analyze using Responses API with web search."""
        try:
            response = self.client.responses.create(
                model=os.getenv("WEB_SEARCH_MODEL", "gpt-4o"),
                input=self._build_prompt(content, title, config),
                tools=[{"type": "web_search"}],
                temperature=config.get("temperature", 0.3)
            )
            
            return {
                "analysis": response.output_text,
                "web_search_used": True,
                "success": True
            }
        except Exception as e:
            self.logger.error(f"Web search analysis failed: {e}")
            # Fallback to standard analysis
            return self._analyze_standard(content, title, config)
    
    def _analyze_standard(self, content: str, title: str, config: Dict) -> Dict[str, Any]:
        """Standard analysis without web search."""
        completion = self.client.chat.completions.create(
            model=self.config.openai.model,
            messages=[
                {"role": "system", "content": config.get("system", "You are an AI analyst.")},
                {"role": "user", "content": self._build_prompt(content, title, config)}
            ],
            temperature=config.get("temperature", 0.3)
        )
        
        return {
            "analysis": completion.choices[0].message.content,
            "web_search_used": False,
            "success": True
        }
    
    @abstractmethod
    def _build_prompt(self, content: str, title: str, config: Dict) -> str:
        """Build the user prompt based on configuration."""
        pass
```

### 3. Updated Pipeline Processor

```python
# In pipeline_processor.py - enhanced initialization
def __init__(self, config: PipelineConfig, notion_client: NotionClient):
    # ... existing init code ...
    
    # Initialize prompt configuration
    self.prompt_config = PromptConfig()
    
    # Initialize advanced AI components with prompt config
    self.summarizer = AdvancedContentSummarizer(config.openai, self.prompt_config)
    self.classifier = AdvancedContentClassifier(config.openai, self._load_taxonomy(), self.prompt_config)
    self.insights_generator = AdvancedInsightsGenerator(config.openai, self.prompt_config)

# In enrich_content method - pass content type
def enrich_content(self, content: str, item: Dict) -> EnrichmentResult:
    # ... existing code ...
    
    # Get content type from the item if already classified
    existing_content_type = item['properties'].get('Content-Type', {}).get('select', {}).get('name')
    
    # Generate analyses with content-type awareness
    core_summary = self.summarizer.generate_summary(content, title, existing_content_type)
    classification = self.classifier.classify_content(content, title, existing_content_type)
    key_insights = self.insights_generator.generate_insights(content, title, existing_content_type)
```

## Usage Examples

### 1. Enable Web Search for Market Analysis Only

```bash
# .env
ENABLE_WEB_SEARCH=true
SUMMARIZER_WEB_SEARCH=false
INSIGHTS_WEB_SEARCH=false
MARKET_ANALYZER_WEB_SEARCH=true
```

### 2. Different Prompts for Research Papers

```yaml
# config/prompts.yaml
content_types:
  research_paper:
    summarizer:
      system: "Focus on methodology and findings..."
      web_search: true  # Check for recent citations
```

### 3. Programmatic Override

```python
# For specific use cases
analyzer = TechnicalAnalyzer(config)
result = analyzer.analyze(
    content="...", 
    title="...",
    content_type="security_advisory"  # Triggers specific prompts
)
```

## Benefits

1. **Flexible Configuration**: Mix of .env variables and YAML for different use cases
2. **Content-Type Awareness**: Different prompts for different content
3. **Web Search Control**: Granular control over which analyses use web search
4. **Cost Optimization**: Only use web search where it adds value
5. **Backward Compatible**: Existing code continues to work
6. **Easy Testing**: Override configs for testing without code changes

## Migration Path

1. **Phase 1**: Add PromptConfig class without changing existing behavior
2. **Phase 2**: Update analyzers to accept content_type parameter
3. **Phase 3**: Enable web search for specific analyzers
4. **Phase 4**: Add content-type-specific prompts
5. **Phase 5**: Full prompt customization via UI (future)