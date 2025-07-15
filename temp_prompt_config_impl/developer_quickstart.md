# Developer Quick Start Guide

## 🚀 Getting Started with Prompt Configuration Implementation

### Prerequisites
- Python 3.9+
- Access to OpenAI API with Responses API enabled
- Knowledge Pipeline dev environment set up

### Key Files to Review First

1. **Current Implementation**:
   - `src/enrichment/pipeline_processor.py` - Main orchestrator
   - `src/enrichment/advanced_summarizer.py` - Example analyzer
   - `src/core/config.py` - Current config system

2. **Design Docs**:
   - `docs/prompt_configuration_design.md` - Full design
   - `docs/enrichment_extension_visual.md` - Visual overview

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/prompt-config-web-search

# 2. Set up test environment
cp .env.example .env.test
echo "ENABLE_WEB_SEARCH=true" >> .env.test
echo "INSIGHTS_WEB_SEARCH=true" >> .env.test

# 3. Run tests after each change
pytest tests/enrichment/test_prompt_config.py -v
```

### Code Templates

#### 1. Analyzer with Web Search Support
```python
class YourAnalyzer(BaseAnalyzer):
    def _build_prompt(self, content: str, title: str, config: Dict) -> str:
        # Use config["system"] for system message
        # Use config["temperature"] for temperature
        # Web search handled by base class
        return f"Analyze: {title}\n\n{content[:8000]}"
```

#### 2. Testing Web Search
```python
def test_web_search_toggle():
    os.environ["MARKET_ANALYZER_WEB_SEARCH"] = "true"
    analyzer = MarketAnalyzer(config)
    result = analyzer.analyze("Apple stock news", "AAPL Update")
    assert result["web_search_used"] == True
```

### Common Pitfalls to Avoid

1. **Don't hardcode prompts** - Always use PromptConfig
2. **Handle web search failures** - Always provide fallback
3. **Watch token limits** - Web search adds tokens
4. **Test content types** - Each type needs different prompts

### Questions During Development?

- Technical questions → #knowledge-pipeline-dev
- Design questions → Check with Product Manager
- API issues → Check OpenAI status page first

Good luck! 🎉