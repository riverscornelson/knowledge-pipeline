# Knowledge Pipeline v2.0 - Project Overview

## Executive Summary

The Knowledge Pipeline is an enterprise-grade content intelligence system that automatically ingests, processes, and enriches content from multiple sources into a centralized Notion knowledge base. Built with a modular architecture prioritizing Google Drive as the primary content source, it delivers 75% faster processing through streamlined AI analysis.

## Key Features

### 🎯 Intelligent Content Processing
- **Multi-Source Ingestion**: Google Drive PDFs, Gmail newsletters, and web content
- **AI-Powered Enrichment**: Automated summarization, classification, and insight extraction using GPT-4.1
- **Smart Deduplication**: SHA-256 hashing prevents duplicate content
- **Structured Storage**: Rich Notion database with metadata and formatted content blocks

### 🚀 Performance & Architecture
- **75% Faster Processing**: Optimized from 20+ AI calls to just 3 per document
- **Priority-Based System**: Google Drive as primary source, others as secondary
- **Modular Design**: Clean separation of concerns with professional Python packaging
- **Resilient Operations**: Built-in retry logic and graceful error handling

### 🔧 Enterprise Ready
- **Professional Structure**: Follows Python best practices with proper packaging
- **Comprehensive Logging**: Structured JSON logs with performance metrics
- **Flexible Configuration**: Environment-based configuration for easy deployment
- **Extensible Framework**: Easy to add new sources or processors

## Technology Stack

- **Language**: Python 3.11+
- **AI**: OpenAI GPT-4.1 (configurable models)
- **Storage**: Notion API v2
- **Authentication**: OAuth2 (Gmail), Service Account (Google Drive)
- **Web Scraping**: Firecrawl API
- **Document Processing**: PDFMiner.six

## Use Cases

1. **Research & Development**: Automated collection and analysis of industry papers and articles
2. **Competitive Intelligence**: Systematic tracking of market developments and vendor capabilities
3. **Knowledge Management**: Centralized repository of processed and enriched content
4. **Executive Briefings**: AI-generated insights from multiple content sources

## Getting Started

```bash
# Install
pip install -e .

# Configure
cp .env.example .env
# Edit .env with your credentials

# Run
python scripts/run_pipeline.py
```

## Architecture Highlights

- **Primary Source**: Google Drive (highest priority)
- **Secondary Sources**: Gmail, Web scraping (lower priority)
- **Processing Pipeline**: Ingest → Deduplicate → Enrich → Store
- **AI Analysis**: Summary, Classification, Insights generation

## Project Structure

```
knowledge-pipeline/
├── src/                # Core application code
│   ├── core/          # Configuration and models
│   ├── drive/         # Google Drive integration (PRIMARY)
│   ├── enrichment/    # AI processing modules
│   └── secondary_sources/  # Gmail, web scraping
├── scripts/           # Executable entry points
├── docs/              # Technical documentation
└── tests/             # Test suite
```

## Support & Documentation

- **Architecture Guide**: `docs/architecture.md`
- **API Reference**: `docs/api_reference.md`
- **Configuration**: See `.env.example` for all options

---

Built for scale, designed for intelligence, optimized for performance.