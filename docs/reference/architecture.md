# Knowledge Pipeline Architecture

## Overview

The Knowledge Pipeline is a modular system for ingesting, processing, and enriching content from Google Drive PDFs into a Notion database. The v3.0 architecture focuses exclusively on Google Drive while preserving extensibility for future sources.

## Core Design Principles

1. **Modularity**: Clear separation of concerns with dedicated modules
2. **Drive-Focused**: Streamlined for Google Drive PDF processing
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
│  │    Google Drive         │  │  Future Sources         │  │
│  │  - PDF Processing       │  │  (see FUTURE_FEATURES) │  │
│  │  - Deduplication        │  │  - Gmail (planned)      │  │
│  │  - Metadata Extraction  │  │  - Web content (planned)│  │
│  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Enrichment Pipeline                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Enhanced Prompt System                    │ │
│  │  ┌──────────────┐  ┌─────────────────────────────────┐ │ │
│  │  │ YAML Prompts │  │      Notion Prompt Database     │ │ │
│  │  │  (Default)   │  │      (Dynamic Override)        │ │ │
│  │  └──────────────┘  └─────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Summarizer  │  │  Classifier  │  │ Insights Gen   │   │
│  │ + Web Search │  │ + AI Vendor  │  │ + Quality Score│   │
│  │   (GPT-4.1)  │  │   Detection  │  │   (GPT-4.1)    │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               Enhanced Formatter                       │ │
│  │     (Rich text, callouts, toggles, hierarchy)         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Storage Layer                              │
│                  Notion Database                             │
│    (Enhanced formatting + Quality metrics + Dynamic tags)   │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### Core (`src/core/`)
- **config.py**: Centralized configuration management
- **models.py**: Data models and schemas
- **notion_client.py**: Enhanced Notion API wrapper
- **prompt_config_enhanced.py**: Dynamic prompt management with Notion integration

### Drive Module (`src/drive/`)
- **ingester.py**: Main Drive ingestion logic
- **pdf_processor.py**: PDF text extraction
- **deduplication.py**: Content deduplication service

### Enrichment (`src/enrichment/`)
- **pipeline_processor.py**: Enhanced enrichment orchestrator with quality scoring
- **advanced_classifier.py**: Semantic content classification with AI vendor detection
- **summarizer.py**: Content summarization with web search
- **insights.py**: Key insights extraction with quality assessment

### Utils (`src/utils/`)
- **logging.py**: Structured JSON logging
- **resilience.py**: API retry and error handling
- **markdown.py**: Markdown to Notion conversion
- **notion_formatter.py**: Enhanced Notion formatting with rich text and visual hierarchy

## Data Flow

1. **Ingestion Phase**
   - Sources push content to Notion with Status="Inbox"
   - Content is deduplicated using SHA-256 hashing
   - Metadata is extracted and stored

2. **Enrichment Phase**
   - Enhanced processor loads dynamic prompts from Notion/YAML hierarchy
   - Advanced classification determines semantic content type and AI vendor
   - AI models generate content-specific summaries with optional web search
   - Quality scoring assesses output completeness and relevance
   - Enhanced formatter creates rich Notion blocks with visual hierarchy
   - Status updated to "Enriched" with quality score

3. **Enhanced Storage Format**
   - **Properties**: Title, Status, Hash, URLs, Quality Score, AI Vendor, Semantic Type
   - **Dynamic Tags**: Automatically generated topical and domain tags
   - **Rich Content Blocks**:
     - 📄 Source Material (with formatting preservation)
     - 📋 Enhanced Summary (with callouts and structure)
     - 💡 Strategic Insights (with action items)
     - 🎯 Advanced Classification (with confidence scores)
     - 📊 Quality Metrics (scoring breakdown)

## Enhanced Prompt System Architecture

### Hierarchical Prompt Loading

The enhanced prompt system uses a hierarchical approach for maximum flexibility:

```
1. YAML Base Prompts (config/prompts.yaml)
   └─> Default prompts for all analyzers
   
2. Notion Dynamic Prompts (Notion Database)
   └─> Override YAML prompts when available
   └─> Searchable by: category/content_type (e.g., "summarizer/Research")
   
3. Environment Variable Overrides
   └─> Runtime configuration of models, web search, etc.
```

### Prompt Resolution Flow

```python
def get_prompt(category, content_type):
    # 1. Check Notion database (with 5-minute cache)
    notion_prompt = notion_db.get_prompt(f"{category}/{content_type}")
    if notion_prompt and notion_prompt.active:
        return notion_prompt
    
    # 2. Fall back to YAML configuration
    yaml_prompt = yaml_config.get_prompt(category, content_type)
    return yaml_prompt
```

### Dynamic Features

- **Live Updates**: Notion changes reflect immediately (after cache expiry)
- **A/B Testing**: Toggle prompts active/inactive for testing
- **Version Control**: Track prompt versions and rollback capability
- **Content-Type Specialization**: Different prompts per content type
- **Web Search Control**: Per-prompt web search enablement

## Configuration

Configuration is managed through environment variables and the `PipelineConfig` class:

```python
config = PipelineConfig.from_env()
# Access sub-configurations
notion_config = config.notion
drive_config = config.google_drive
openai_config = config.openai

# Enhanced features
enhanced_config = config.enhanced_prompts
```

### Enhanced Configuration Options

```bash
# Enable enhanced features
USE_ENHANCED_PROMPTS=true
USE_ENHANCED_FORMATTING=true
ENABLE_QUALITY_SCORING=true

# Notion prompt database
NOTION_PROMPTS_DATABASE_ID=your_database_id
PROMPT_CACHE_DURATION_MINUTES=5

# Web search integration
ENABLE_WEB_SEARCH=true
WEB_SEARCH_TIMEOUT_SECONDS=30
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

1. Create module in `src/` with appropriate subdirectory
2. Implement base ingester interface
3. Add configuration to `PipelineConfig`
4. Update `run_pipeline.py` to include new source

## Security Considerations

- **Credentials**: Never committed, loaded from environment
- **Service Accounts**: Used for Google APIs
- **Token Management**: OAuth2 with automatic refresh
- **Data Privacy**: No sensitive data logged