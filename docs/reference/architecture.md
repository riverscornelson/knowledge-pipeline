# Knowledge Pipeline Architecture

## Overview

The Knowledge Pipeline is a modular system for ingesting, processing, and enriching content from multiple sources into a Notion database. The architecture prioritizes Google Drive as the primary content source while maintaining support for secondary sources.

## Core Design Principles

1. **Modularity**: Clear separation of concerns with dedicated modules
2. **Priority-Based**: Drive content takes precedence over other sources
3. **Extensibility**: Easy to add new sources or processors
4. **Resilience**: Built-in retry logic and error handling
5. **Performance**: Optimized batch processing and caching

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Entry Points                          │
│              (scripts/run_pipeline.py)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Core Components                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Config    │  │ Notion Client │  │     Models      │   │
│  │ Management  │  │   Wrapper     │  │   & Schemas     │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Content Sources                            │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   Primary: Drive        │  │  Secondary Sources      │  │
│  │  - PDF Processing       │  │  - Gmail                │  │
│  │  - Deduplication        │  │  - Firecrawl           │  │
│  │  - Metadata Extraction  │  │  - Web Scraping        │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Enrichment Pipeline                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Summarizer  │  │  Classifier  │  │ Insights Gen   │   │
│  │   (GPT-4.1)  │  │ (GPT-4.1-mini)│  │   (GPT-4.1)    │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Storage Layer                              │
│                  Notion Database                             │
│         (Structured properties + Rich content)               │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### Core (`src/core/`)
- **config.py**: Centralized configuration management
- **models.py**: Data models and schemas
- **notion_client.py**: Enhanced Notion API wrapper

### Drive Module (`src/drive/`)
- **ingester.py**: Main Drive ingestion logic
- **pdf_processor.py**: PDF text extraction
- **deduplication.py**: Content deduplication service

### Enrichment (`src/enrichment/`)
- **processor.py**: Main enrichment orchestrator
- **summarizer.py**: Content summarization
- **classifier.py**: Content classification
- **insights.py**: Key insights extraction

### Utils (`src/utils/`)
- **logging.py**: Structured JSON logging
- **resilience.py**: API retry and error handling
- **markdown.py**: Markdown to Notion conversion

## Data Flow

1. **Ingestion Phase**
   - Sources push content to Notion with Status="Inbox"
   - Content is deduplicated using SHA-256 hashing
   - Metadata is extracted and stored

2. **Enrichment Phase**
   - Processor queries for Status="Inbox" items
   - AI models generate summaries, classifications, and insights
   - Results stored as Notion properties and content blocks
   - Status updated to "Enriched" or "Failed"

3. **Storage Format**
   - Properties: Title, Status, Hash, URLs, Classifications
   - Content Blocks:
     - 📄 Raw Content (source material)
     - 📋 Core Summary (AI analysis)
     - 💡 Key Insights (actionable items)
     - 🎯 Classification (metadata)

## Configuration

Configuration is managed through environment variables and the `PipelineConfig` class:

```python
config = PipelineConfig.from_env()
# Access sub-configurations
notion_config = config.notion
drive_config = config.google_drive
openai_config = config.openai
```

## Error Handling

- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Continue processing on individual failures
- **Structured Logging**: All errors logged with context
- **Status Tracking**: Failed items marked for manual review

## Performance Optimizations

- **Batch Processing**: Process multiple items in parallel
- **Rate Limiting**: Respect API limits with configurable delays
- **Caching**: Avoid redundant API calls
- **Streaming**: Handle large files without memory issues

## Extensibility

To add a new content source:

1. Create module in `src/secondary_sources/`
2. Implement base ingester interface
3. Add configuration to `PipelineConfig`
4. Update `run_pipeline.py` to include new source

## Security Considerations

- **Credentials**: Never committed, loaded from environment
- **Service Accounts**: Used for Google APIs
- **Token Management**: OAuth2 with automatic refresh
- **Data Privacy**: No sensitive data logged