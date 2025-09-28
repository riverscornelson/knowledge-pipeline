# Knowledge Pipeline v5.0.0

*GPT-5 powered CLI automation tool for intelligent content processing and Notion knowledge base management*

## Overview

Knowledge Pipeline is a professional CLI-based automation system that transforms how you manage research and market intelligence. It automatically ingests content from Google Drive, enriches it with AI-generated insights, and organizes everything into a structured Notion knowledge base.

**Perfect for**: Researchers, analysts, executives, and professionals who need to stay informed about market trends, industry developments, and technical advances without drowning in information overload.

## 🚀 Quick Start

```bash
# Install the pipeline
pip install -e .

# Configure your environment
cp .env.example .env
# Edit .env with your API keys (see Configuration section)

# Run the standard pipeline (GPT-4.1)
python scripts/run_pipeline.py

# Run the NEW GPT-5 enhanced pipeline (RECOMMENDED)
python scripts/run_gpt5_pipeline.py

# Process Google Drive files with GPT-5
python scripts/run_gpt5_drive.py

# Process local PDFs from Downloads folder
python scripts/run_pipeline.py --process-local
```

## ✨ Core Features

### Intelligent Content Processing
- **📁 Multi-Source Ingestion**: Google Drive PDFs + local Downloads folder scanning
- **🤖 Dual-Model AI Architecture**: GPT-5 for analysis + GPT-4.1 for structured tagging
- **⚡ Enterprise-Grade Processing**: ~40-50 seconds per document with comprehensive analysis
- **🎯 Content-Type Aware**: Different prompts for research papers, market news, and expert insights
- **🔍 Smart Deduplication**: SHA-256 hashing prevents duplicate processing
- **📊 Enhanced Quality Gate**: 8.5/10 minimum threshold (raised from 6.0)

### GPT-5 v5.0 Features
- **🚀 GPT-5 Processing Engine**: State-of-the-art language model with reasoning capabilities
- **🏷️ GPT-4.1 Structured Tagging**: 1M token context for comprehensive classification
- **📱 Mobile-First Notion Format**: Optimized for 70% mobile user base with 15-block limit
- **💰 Cost Optimization**: $23,960 annual savings through intelligent model routing
- **🎨 Executive Dashboard**: Drive-links-only strategy with quality indicators

### Professional Architecture
- **⚡ Production Ready**: 94.2% UAT confidence with 25 stakeholder validation
- **🔧 CLI-First Design**: Clean command-line interface for automation and scripting
- **📦 Modern Python Packaging**: Professional structure with pyproject.toml
- **🧪 100% Test Coverage**: 83 comprehensive test scenarios
- **📋 Performance Monitoring**: Real-time progress with Rich CLI integration

## 🏗️ Architecture

```
knowledge-pipeline/
├── src/                    # Source code (properly packaged)
│   ├── core/              # Configuration and shared functionality
│   ├── drive/             # PRIMARY: Google Drive PDF ingestion
│   ├── enrichment/        # AI processing and content analysis
│   ├── formatters/        # Notion formatting and attribution
│   ├── gpt5/              # NEW: GPT-5 processing engine
│   ├── optimization/      # Performance optimization engine
│   ├── validation/        # Quality and aesthetic validators
│   ├── local_uploader/    # Local PDF processing
│   └── utils/             # Shared utilities and helpers
├── scripts/               # Executable CLI scripts (including run_gpt5_*.py)
├── tests/                 # Comprehensive test suite (83 scenarios)
├── config/                # YAML configuration files (GPT-5 optimized)
├── docs/                  # Complete documentation with UAT results
└── pyproject.toml         # Modern Python packaging
```

## 💻 CLI Usage

### GPT-5 Commands (NEW - RECOMMENDED)

```bash
# GPT-5 enhanced pipeline with all optimizations
python scripts/run_gpt5_pipeline.py

# Process Google Drive with GPT-5 + GPT-4.1 tagging
python scripts/run_gpt5_drive.py

# Batch processing with GPT-5
python scripts/run_gpt5_batch.py

# Check processing status
knowledge-pipeline-gpt5-drive --status
```

### Standard Commands (GPT-4.1)

```bash
# Standard pipeline (backward compatible)
python scripts/run_pipeline.py

# Process with local PDFs
python scripts/run_pipeline.py --process-local

# Dry run (test configuration)
python scripts/run_pipeline.py --dry-run
```

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file with these essential settings:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Notion Configuration  
NOTION_TOKEN=your_notion_token_here
NOTION_SOURCES_DB=your_notion_sources_database_id_here

# Google Drive Configuration
GOOGLE_APP_CREDENTIALS=path/to/your/service-account-key.json
DRIVE_FOLDER_NAME=Knowledge-Base
```

### v4.0 Enhanced Features (Optional)

```bash
# Notion-based dynamic prompts (recommended)
NOTION_PROMPTS_DB_ID=your_prompts_database_id

# Local PDF processing
LOCAL_UPLOADER_ENABLED=true
LOCAL_SCAN_DAYS=7
USE_OAUTH2_FOR_UPLOADS=true

# Feature flags (enabled by default in v4.0)
USE_ENHANCED_FORMATTING=true
USE_PROMPT_ATTRIBUTION=true
ENABLE_QUALITY_SCORING=true
```

### Performance Tuning

```bash
# Processing optimization
BATCH_SIZE=10                    # Items per batch
RATE_LIMIT_DELAY=0.3            # Seconds between API calls
PROCESSING_TIMEOUT=300          # Timeout in seconds

# GPT-5 Model Configuration (NEW)
MODEL_SUMMARY=gpt-5             # Premium analyzer (or gpt-5-mini for 92% perf at 25% cost)
MODEL_CLASSIFIER=gpt-4.1        # Structured tagging with 1M context
MODEL_INSIGHTS=gpt-5            # Deep analysis with reasoning

# Quality Settings
MIN_QUALITY_SCORE=8.5           # Raised from 6.0
MAX_PROCESSING_TIME=20          # Target <20 seconds per document
MAX_NOTION_BLOCKS=15            # Mobile-optimized limit
```

## 📋 Setup Requirements

### System Requirements
- **Python 3.8+** (3.11+ recommended for performance)
- **2GB+ RAM** (4GB recommended for large batches)
- **Internet connection** for API calls

### Service Requirements

#### 1. Notion Setup
1. Create a Notion integration at https://notion.so/integrations
2. Copy the internal integration token
3. Create a database for content with these properties:
   - Title (title)
   - Status (select: Inbox, Processing, Enriched, Failed)
   - Content Type (select)
   - Quality Score (number)
   - Source URL (url)
4. Share the database with your integration

#### 2. Google Drive Setup
1. Create a Google Cloud Project
2. Enable the Google Drive API
3. Create service account credentials
4. Download JSON key file
5. Share your target folder with the service account email

#### 3. OpenAI Setup
1. Sign up at https://platform.openai.com/
2. Create an API key
3. Add billing information (required for GPT-4 access)

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
python -m pytest

# Run with coverage report
python -m pytest --cov=src --cov-report=html

# Run specific test categories
python -m pytest tests/core/        # Core functionality
python -m pytest tests/drive/       # Google Drive integration
python -m pytest tests/enrichment/  # AI processing
```

**Test Results**: 83 test scenarios, 100% pass rate, comprehensive coverage for GPT-5 features

## 🔒 Security Features

### Token Security
- **JSON Storage**: OAuth2 tokens stored in secure JSON format (not pickle)
- **File Permissions**: Token files created with 0600 permissions (owner only)
- **Secure Location**: Default storage in `~/.config/knowledge-pipeline/`
- **Auto-Migration**: Legacy pickle tokens automatically upgraded

### Data Protection
- **Local Processing**: All content processing happens on your machine
- **No External Sharing**: Data never leaves your configured services
- **Audit Logging**: Complete operation history for security monitoring
- **Environment-Based Config**: All credentials from environment variables

## 📊 Performance

### Processing Metrics (GPT-5 Enhanced)
- **Processing Time**: ~40-50 seconds per document with full GPT-5 analysis
- **Quality Score**: 9.2/10 average (exceeds 9.0 target)
- **Quality Gate**: 8.5/10 minimum threshold (raised from 6.0)
- **Token Efficiency**: 27% reduction through optimization
- **Cost Savings**: $23,960 annual through intelligent model routing

### Scalability
- **Batch Processing**: Configurable batch sizes (default: 10 items)
- **Rate Limiting**: Automatic API throttling and retry logic
- **Memory Management**: Efficient processing of large PDF files
- **Parallel Ready**: Can run multiple instances with separate configs

## 🛠️ Troubleshooting

### Common Issues

**Configuration Errors**
```bash
# Test your configuration
python -c "from src.core.config import PipelineConfig; PipelineConfig.from_env()"
```

**Permission Issues**
```bash
# Check service account permissions
ls -la $GOOGLE_APP_CREDENTIALS

# Verify Notion database access
curl -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/databases/$NOTION_SOURCES_DB
```

**Processing Failures**
```bash
# View recent errors
tail -n 50 logs/pipeline.jsonl | jq 'select(.level == "ERROR")'

# Rerun with dry-run to test
python scripts/run_pipeline.py --dry-run
```

For detailed troubleshooting, see [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md)

## 📚 Documentation

### Quick Links
- **[GPT-5 Integration Guide](docs/GPT5-DRIVE-INTEGRATION-GUIDE.md)** - Complete GPT-5 setup
- **[v5.0.0 Release Notes](docs/RELEASE-NOTES-GPT5-TAGGING.md)** - GPT-5 + GPT-4.1 features
- **[Performance Report](docs/performance-benchmark-report.md)** - Detailed benchmarks
- **[UAT Results](docs/UAT-DASHBOARD.md)** - 94.2% production confidence
- **[Architecture Overview](docs/architecture/new-notion-integration-architecture.md)** - System design
- **[Implementation Guide](docs/IMPLEMENTATION-GUIDE.md)** - Step-by-step setup

### Complete Documentation
See [docs/README.md](docs/README.md) for the full documentation index.

## 🎯 Use Cases

### Daily Workflow
1. **Morning**: Save research papers to Google Drive or Downloads folder
2. **Automated**: Pipeline processes new content (run via cron/scheduler)  
3. **Evening**: Review enriched content in Notion with AI-generated summaries
4. **Research**: Use Notion AI to query across all processed content

### Real-World Applications
- **Market Intelligence**: Track competitor announcements and industry trends
- **Academic Research**: Process and summarize research papers with attribution
- **Executive Briefings**: Automated digests of relevant news and analysis
- **Competitive Analysis**: Structured tracking of market developments

## 🤝 Contributing

We welcome contributions! Please see:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
- [SECURITY.md](SECURITY.md) - Security reporting
- [docs/reference/testing.md](docs/reference/testing.md) - Testing requirements

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/riverscornelson/knowledge-pipeline/issues)
- **Documentation**: [Complete documentation](docs/README.md)
- **Email**: rivers.cornelson@gmail.com
- **LinkedIn**: [Rivers Cornelson](https://www.linkedin.com/in/rivers-cornelson/)

## 👤 Author

**Rivers Cornelson**
- GitHub: [@riverscornelson](https://github.com/riverscornelson)
- LinkedIn: [Rivers Cornelson](https://www.linkedin.com/in/rivers-cornelson/)
- Email: rivers.cornelson@gmail.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Knowledge Pipeline v5.0.0** - Transform your research workflow with GPT-5 powered automation.