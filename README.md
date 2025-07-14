# Knowledge Pipeline v2.0

*A personal knowledge automation system for staying ahead in AI*

## The Story Behind This Pipeline

In the rapidly evolving world of AI, staying informed isn't just important—it's essential. Yet the sheer volume of papers, articles, newsletters, and updates makes it impossible to read everything. That's why I built this knowledge pipeline.

This isn't a tool to replace reading or research. It's a workflow enhancement that seamlessly integrates with how I already work. Every morning, I save interesting PDFs to a designated Google Drive folder. Throughout the week, I come across compelling articles and newsletters. Rather than letting these accumulate in an ever-growing "read later" list, this pipeline automatically:

1. **Captures** content from my research sources (Drive, Gmail, web)
2. **Enriches** it with AI-generated summaries and classifications
3. **Stores** everything in my Notion "second brain"

The magic happens in Notion. While I have many databases for different aspects of my work and life, the Sources database serves as my research repository. With months of processed content, I can use Notion AI to instantly synthesize insights across time periods, identify trends, and surface connections I might have missed.

This pipeline runs locally on my machine, giving me full control over my data while enhancing—not replacing—my natural research workflow. It's designed to work with how I think, not force me into a rigid system.

## What This Pipeline Does

An intelligent content processing system that automatically ingests, enriches, and organizes research materials into a structured Notion knowledge base. Built with a modular architecture prioritizing Google Drive as the primary content source, it delivers AI-powered insights while maintaining human control over the research process.

## 🚀 Quick Start

```bash
# Install
pip install -e .

# Configure (copy and edit .env.example)
cp .env.example .env

# Run pipeline
python scripts/run_pipeline.py
```

## 🚀 Running the Pipeline

The v2.0 pipeline is now the production standard:

```bash
# Full pipeline (all sources + enrichment)
python scripts/run_pipeline.py

# Drive-only ingestion (primary source)
python scripts/run_pipeline.py --source drive

# Skip enrichment phase
python scripts/run_pipeline.py --skip-enrichment
```

**Note**: The legacy `pipeline_consolidated.sh` has been archived. Use `scripts/run_pipeline.py` for all operations.

## 🎯 Key Features

### Intelligent Content Processing
- **Multi-Source Ingestion**: Google Drive PDFs, Gmail newsletters, and web content
- **AI-Powered Enrichment**: Automated summarization, classification, and insight extraction using GPT-4.1
- **Smart Deduplication**: SHA-256 hashing prevents duplicate content
- **Structured Storage**: Rich Notion database with metadata and formatted content blocks

### Performance & Architecture  
- **75% Faster Processing**: Optimized from 20+ AI calls to just 3 per document
- **Priority-Based System**: Google Drive as primary source, others as secondary
- **Modular Design**: Clean separation of concerns with professional Python packaging
- **Resilient Operations**: Built-in retry logic and graceful error handling

### Enterprise Ready
- **Professional Structure**: Follows Python best practices with proper packaging
- **Comprehensive Logging**: Structured JSON logs with performance metrics
- **Flexible Configuration**: Environment-based configuration for easy deployment
- **Extensible Framework**: Easy to add new sources or processors
- **Test Coverage**: 100% test pass rate with comprehensive unit and integration tests

## 📁 Project Structure

```
knowledge-pipeline/
├── src/                    # Source code (properly packaged)
│   ├── core/              # Core functionality  
│   ├── drive/             # PRIMARY: Drive ingestion
│   ├── enrichment/        # AI processing
│   ├── secondary_sources/ # Gmail, RSS, Firecrawl (lower priority)
│   └── utils/             # Shared utilities
├── scripts/               # Executable scripts
├── tests/                 # Organized test suite
├── config/                # Configuration files
├── docs/                  # Documentation
└── pyproject.toml         # Modern Python packaging
```

## 💻 Technology Stack

- **Language**: Python 3.8+ (3.11+ recommended)
- **AI**: OpenAI GPT-4.1 (configurable models)
- **Storage**: Notion API v2
- **Authentication**: OAuth2 (Gmail), Service Account (Google Drive)
- **Web Scraping**: Firecrawl API
- **Document Processing**: PDFMiner.six

## 🔧 Configuration

Same environment variables as before, now centrally managed:

```python
from src.core.config import PipelineConfig
config = PipelineConfig.from_env()
```

## 📚 Documentation

See [docs/README.md](docs/README.md) for complete documentation navigation.

### Quick Links
- [Quick Start](docs/getting-started/quick-start.md) - Get running in 5 minutes
- [Architecture Overview](docs/reference/architecture.md) - System design and data flow
- [API Reference](docs/reference/api.md) - Complete API documentation
- [Testing Guide](docs/reference/testing.md) - Test suite documentation
- [Deployment Guide](docs/operations/deployment.md) - Production deployment options
- [Troubleshooting](docs/operations/troubleshooting.md) - Common issues and solutions

## 🧪 Testing

Run the test suite to verify installation and functionality:

```bash
# Run all tests
python -m pytest

# Run with coverage report
python -m pytest --cov=src --cov-report=html

# Run specific test categories
python -m pytest tests/core/  # Core module tests
python -m pytest tests/drive/  # Drive integration tests
python -m pytest tests/enrichment/  # AI enrichment tests
```

The test suite includes:
- **49 tests** with 100% pass rate
- **38% code coverage** overall (94-100% for core modules)
- Unit tests for all major components
- Integration tests for end-to-end workflows
- All external services properly mocked

See [Testing Guide](docs/reference/testing.md) for detailed testing documentation.

## 🚦 Migration Status

- ✅ Directory structure created
- ✅ Python packaging setup
- ✅ Drive ingestion migrated
- ✅ Configuration management
- ✅ Documentation updated
- ✅ Enrichment module migration
- ✅ Secondary sources migration
- ✅ Newsletter deprecation
- ✅ Comprehensive test suite

## 🎯 How I Use This Pipeline

### Daily Workflow
1. **Morning Research**: Save interesting AI papers and articles to my Drive folder
2. **Throughout the Day**: The pipeline runs automatically, processing new content
3. **Weekly Review**: Use Notion AI to query across all sources: "What were the key AI breakthroughs this month?"
4. **Strategic Planning**: Surface patterns and trends from months of collected research

### Real-World Examples
- **Tracking AI Model Releases**: Every new model paper gets automatically summarized with key innovations highlighted
- **Competitive Intelligence**: Newsletter mentions of companies get tagged and classified
- **Technology Trends**: Ask Notion AI to identify emerging patterns across 6 months of content
- **Research Synthesis**: Combine insights from multiple papers on similar topics

### Beyond Notion
The structured data in Notion isn't locked away. I regularly export collections of processed content to feed into other AI tools for deeper analysis—whether that's Claude for comprehensive research reports, GPT-4 for trend analysis, or specialized tools for specific research tasks. The pipeline creates a foundation of organized, enriched content that enhances every AI tool I use.

## 📋 Requirements

- Python 3.8+ (3.11+ recommended for performance)
- Notion account with API access
- Google Cloud service account (for Drive)
- OpenAI API key
- Optional: Gmail OAuth2 credentials, Firecrawl API key

## 🚦 Project Status

- ✅ v2.0 Migration Complete (July 13, 2025)
- ✅ Production Ready
- ✅ All documentation updated
- ✅ Professional Python packaging
- ✅ Comprehensive test structure

---

Built for scale, designed for intelligence, optimized for performance.