# Knowledge Pipeline v3.0

*A personal automation system for staying ahead on market news. Focuses on efficient loading of information to a Notion second-brain notetaking system.*

## The Story Behind This Pipeline

Staying informed about market news is a marathon, not a sprint. Adding structure to the process of reviewing market updates is something that can benefit most professionals, and modern second-brain notetaking systems are evolving with tools like embedded AI assistants, like Notion AI, that can increase the usability of stored notes.

This isn't a tool to replace reading or independent research, which are both key to fully understanding a market or focus area. Instead, it's a workflow enhancement that provides a "save it for later" system that can be used ad-hoc when encountering new information, or to automatically save down selected feeds of information into a consistent structure. Rather than letting market news, research, and expert insights accumulate in an ever-growing "read later" list, this pipeline automatically:

1. **Captures** content from research sources (Google Drive, Gmail, Configured Websites)
2. **Enriches** it with AI-generated summaries and classifications
3. **Stores** everything in a Notion "second brain"

Using this system over time will create months of processed content, which Notion AI and Claude can conduct research over to distill valuable information and trends when there is a need.

This pipeline runs locally on my machine, giving users full control over their data and keeping things simple for future maintainability. It's designed to work with how users think, not force them into a rigid system.

## What This Pipeline Does

An intelligent content processing system that automatically ingests, enriches, and organizes research materials into a structured Notion knowledge base. Prompts are applied based on Content Type to ensure that things like Market News, Research Papers, and Expert Insights all get processed in relevant and valuable ways. 

Built with a modular architecture prioritizing Google Drive as the primary content source, it delivers AI-powered insights while ensuring that all original content can be referenced to avoid over-reliance on LLM capabilities. 

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

The v3.0 pipeline is now the production standard:

```bash
# Full pipeline (all sources + enrichment)
python scripts/run_pipeline.py

# Drive-only ingestion (primary source)
python scripts/run_pipeline.py --source drive

# Skip enrichment phase
python scripts/run_pipeline.py --skip-enrichment
```

## 🎯 Key Features

### Intelligent Content Processing
- **Multi-Source Ingestion**: Google Drive PDFs, Gmail newsletters, and web content
- **AI-Powered Enrichment**: Automated summarization, classification, and insight extraction using GPT-4.1
- **Advanced Analysis**: Multi-step reasoning with story structures and evidence-based classification
- **Smart Deduplication**: SHA-256 hashing prevents duplicate content
- **Structured Storage**: Rich Notion database with metadata and formatted content blocks

### Performance & Architecture  
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

## 🎯 How to Use This Pipeline

### Daily Workflow
1. **Morning Research**: Save interesting AI papers and articles to a configured Drive folder, focusing on sources that won't be captured by the integrations with Gmail and configured websites.
2. **End of Day**: Run the pipeline locally, processing new content in Drive and in the other content sources.
3. **Review**: Use Notion AI to query across all sources: "What were the key AI breakthroughs this week?", "What insights in this database would be most relevant for helping me to prepare a presentation for a group of manufacturing executives?"

### Real-World Examples
- **Tracking AI Model Releases**: Every new model paper gets automatically summarized with key innovations highlighted, priming Notion AI or Claude (connected via MCP) to conduct research on trends over time.
- **Competitive Intelligence**: Newsletter mentions of companies get tagged and classified in Notion for quick filtering and to aid tools connected to the Notion in their searching of the content.
- **Research Synthesis**: Combine insights from multiple papers on similar topics with a single prompt.

### Beyond Notion
The structured data in Notion isn't locked away or trapped with Notion AI, though the goal is to use Notion AI as the RAG-bot to avoid the need to build it as part of this codebase. MCP servers allow Claude Desktop, Claude Code, and other MCP-ready applications to connect to the Notion in sophisticated ways.
## 📋 Requirements

- Python 3.8+ (3.11+ recommended for performance)
- Notion account with API access
- Google Cloud service account (for Drive)
- OpenAI API key
- Optional: Gmail OAuth2 credentials, Firecrawl API key