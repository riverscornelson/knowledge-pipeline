# Knowledge Pipeline v2.0

*Migration completed: July 13, 2025*

An enterprise-grade content intelligence system that automatically ingests, processes, and enriches content from multiple sources into a centralized Notion knowledge base. Built with a modular architecture prioritizing Google Drive as the primary content source, it delivers 75% faster processing through streamlined AI analysis.

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
- **AI-Powered Enrichment**: Automated summarization, classification, and insight extraction using GPT-4o
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
- **AI**: OpenAI GPT-4o (configurable models)
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
- [Deployment Guide](docs/operations/deployment.md) - Production deployment options
- [Troubleshooting](docs/operations/troubleshooting.md) - Common issues and solutions

## 🚦 Migration Status

- ✅ Directory structure created
- ✅ Python packaging setup
- ✅ Drive ingestion migrated
- ✅ Configuration management
- ✅ Documentation updated
- ✅ Enrichment module migration
- ✅ Secondary sources migration
- ✅ Newsletter deprecation

## 🎯 Use Cases

1. **Research & Development**: Automated collection and analysis of industry papers
2. **Competitive Intelligence**: Systematic tracking of market developments
3. **Knowledge Management**: Centralized repository of processed content
4. **Executive Briefings**: AI-generated insights from multiple sources

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