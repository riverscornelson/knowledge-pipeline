# Knowledge Pipeline v4.0.0

*A personal automation system for staying ahead on market news. Focuses on efficient loading of information to a Notion second-brain notetaking system.*

## The Story Behind This Pipeline

Staying informed about market news is a marathon, not a sprint. Adding structure to the process of reviewing market updates is something that can benefit most professionals, and modern second-brain notetaking systems are evolving with tools like embedded AI assistants, like Notion AI, that can increase the usability of stored notes.

This isn't a tool to replace reading or independent research, which are both key to fully understanding a market or focus area. Instead, it's a workflow enhancement that provides a "save it for later" system that can be used ad-hoc when encountering new information, or to automatically save down selected feeds of information into a consistent structure. Rather than letting market news, research, and expert insights accumulate in an ever-growing "read later" list, this pipeline automatically:

1. **Captures** content from research sources (Google Drive PDFs, local Downloads folder)
2. **Enriches** it with AI-generated summaries and classifications
3. **Stores** everything in a Notion "second brain"

Using this system over time will create months of processed content, which Notion AI and Claude can conduct research over to distill valuable information and trends when there is a need.

This pipeline runs locally on your machine, giving users full control over their data and keeping things simple for future maintainability. It's designed to work with how users think, not force them into a rigid system.

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

The v4.0 pipeline with prompt attribution and enhanced formatting is now the production standard:

```bash
# Full pipeline with local PDF processing (RECOMMENDED)
# Scans your Downloads folder for PDFs and uploads to Drive before processing
python scripts/run_pipeline.py --process-local

# Standard pipeline (Drive content only)
python scripts/run_pipeline.py

# Process local PDFs + skip enrichment (useful for bulk uploads)
python scripts/run_pipeline.py --process-local --skip-enrichment

# Skip enrichment phase (ingestion only)
python scripts/run_pipeline.py --skip-enrichment
```

**💡 Pro Tip**: Use `--process-local` to automatically upload PDFs from your Downloads folder to Google Drive. This is perfect for research papers, reports, and documents you've downloaded but haven't organized yet.

## 🎯 Key Features

### Intelligent Content Processing
- **Multi-Source Ingestion**: Google Drive PDFs and local Downloads folder scanning
- **Local PDF Upload**: Automatically upload PDFs from Downloads to Drive
- **AI-Powered Enrichment**: Automated summarization, classification, and insight extraction using GPT-4.1
- **Prompt Attribution System**: Track which prompts generated each piece of content (v4.0.0)
- **Advanced Analysis**: Multi-step reasoning with story structures and evidence-based classification
- **Intelligent Tagging**: AI-generated topical and domain tags with consistency-first approach
- **Smart Deduplication**: SHA-256 hashing prevents duplicate content
- **Enhanced Notion Formatting**: Rich text with headers, callouts, toggles, attribution blocks, and visual hierarchy
- **Dual-Source Prompt Management**: Notion-based dynamic prompts with YAML fallback for reliability
- **Quality Scoring**: Automated content quality assessment (0-100%) with detailed metrics

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

## 🔒 Security

The pipeline implements several security best practices:

### OAuth2 Token Storage
- **Secure JSON storage**: OAuth2 tokens are stored in JSON format (not pickle) to prevent arbitrary code execution
- **Strict file permissions**: Token files are created with `0600` permissions (owner read/write only)
- **Secure default location**: Tokens stored in `~/.config/knowledge-pipeline/` by default
- **Automatic migration**: Existing pickle-based tokens are automatically migrated to secure storage

### Credential Management
- **No hardcoded secrets**: All credentials loaded from environment variables
- **Secure file handling**: OAuth2 tokens stored with strict permissions in JSON format
- **Token validation**: Corrupted or insecure tokens are automatically removed and regenerated

### Data Protection
- **Local processing**: All data processing happens locally on your machine
- **No external sharing**: Content never leaves your configured services (Google Drive, Notion)
- **Audit logging**: All operations logged for security monitoring

## 📁 Project Structure

```
knowledge-pipeline/
├── src/                    # Source code (properly packaged)
│   ├── core/              # Core functionality  
│   ├── drive/             # PRIMARY: Drive ingestion
│   ├── enrichment/        # AI processing
│   ├── templates/        # Code templates and guides
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
- **Authentication**: OAuth2 for Google Drive (user-owned uploads)
- **Document Processing**: PDFMiner.six

## 🔧 Configuration

### Core Configuration

Environment variables are centrally managed:

```python
from src.core.config import PipelineConfig
config = PipelineConfig.from_env()
```

### Core Features Configuration (v4.0.0)

The pipeline includes comprehensive prompt attribution, quality scoring, and enhanced formatting by default:

```bash
# Core features (enabled by default in v4.0.0)
USE_ENHANCED_FORMATTING=true       # Advanced Notion formatting with attribution
USE_ENHANCED_PROMPTS=true          # Dual-source prompt management (Notion + YAML)
ENABLE_QUALITY_SCORING=true        # AI-powered quality assessment

# Notion integration for dynamic prompts (recommended)
NOTION_API_KEY=secret_your_key_here
NOTION_PROMPTS_DATABASE_ID=your_database_id

# Optional: Disable features if needed
# USE_ENHANCED_FORMATTING=false    # Revert to basic formatting
# USE_ENHANCED_PROMPTS=false       # Use YAML prompts only
```

### Local PDF Processing Configuration

Enable automatic processing of PDFs in your Downloads folder:

```bash
# Enable local PDF processing in .env
LOCAL_UPLOADER_ENABLED=true        # Enable the feature
LOCAL_SCAN_DAYS=7                  # Look for PDFs from last 7 days
LOCAL_DELETE_AFTER_UPLOAD=false    # Keep files after upload
USE_OAUTH2_FOR_UPLOADS=true        # Use OAuth2 (recommended)

# Optional: Upload to specific Drive folder
LOCAL_UPLOAD_FOLDER_ID=your_folder_id_here
```

## 📚 Documentation

See [docs/README.md](docs/README.md) for complete documentation navigation.

### Quick Links
- [Quick Start](docs/getting-started/quick-start.md) - Get running in 5 minutes with v4.0
- [v4.0.0 Release Notes](docs/v4.0.0/release-notes.md) - What's new in v4.0
- [Prompt Attribution Guide](docs/v4.0.0/prompt-attribution.md) - Understanding content attribution
- [Quality Scoring Guide](docs/v4.0.0/quality-scoring.md) - How quality assessment works
- [Notion Database Setup](docs/setup/notion-prompt-database-setup.md) - Dynamic prompt configuration
- [Migration to v4.0](docs/v4.0.0-migration-guide.md) - Upgrade from v3.x
- [Configuration Guide](docs/guides/prompt-configuration-guide.md) - Dual-source prompt management
- [Architecture Overview](docs/v4.0.0-technical-architecture.md) - v4.0 system design
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
1. **Morning Research**: Save interesting AI papers and articles to a configured Drive folder or your Downloads folder for automatic processing.
2. **End of Day**: Run the pipeline locally, processing new content in Drive and in the other content sources.
3. **Review**: Use Notion AI to query across all sources: "What were the key AI breakthroughs this week?", "What insights in this database would be most relevant for helping me to prepare a presentation for a group of manufacturing executives?"

### Real-World Examples
- **Tracking AI Model Releases**: Every new model paper gets automatically summarized with key innovations highlighted, priming Notion AI or Claude (connected via MCP) to conduct research on trends over time.
- **Competitive Intelligence**: Newsletter mentions of companies get tagged and classified in Notion for quick filtering and to aid tools connected to the Notion in their searching of the content.
- **Research Synthesis**: Combine insights from multiple papers on similar topics with a single prompt.

### Beyond Notion
The structured data in Notion isn't locked away or trapped with Notion AI, though the goal is to use Notion AI as the RAG-bot to avoid the need to build it as part of this codebase. MCP servers allow Claude Desktop, Claude Code, and other MCP-ready applications to connect to the Notion in sophisticated ways.

## 👤 Author

**Rivers Cornelson**
- GitHub: [@riverscornelson](https://github.com/riverscornelson)
- LinkedIn: [Rivers Cornelson](https://www.linkedin.com/in/rivers-cornelson/)
- Email: rivers.cornelson@gmail.com

## 📋 Requirements

- Python 3.8+ (3.11+ recommended for performance)
- Notion account with API access
- Google Cloud Project with Drive API enabled
- OAuth2 credentials for Google Drive (for user-owned uploads)
- OpenAI API key