# Future Features

This document outlines planned integrations and features for the knowledge pipeline. The current focus is on Google Drive as the primary and only source, with these features planned for future development.

## Planned Secondary Source Integrations

### Gmail Integration
- **Purpose**: Capture knowledge from email conversations, threads, and attachments
- **Priority**: Medium
- **Complexity**: High
- **Implementation Scope**:
  - OAuth2 authentication flow for Gmail API access
  - Email parsing and thread reconstruction
  - Attachment extraction and processing
  - Smart filtering for relevant content vs. noise
  - Date-based incremental capture

**Technical Requirements**:
- Google Gmail API integration
- OAuth2 credentials management
- Email content parsing and sanitization
- Thread relationship mapping

**Previous Implementation Note**: Basic implementation existed in `src/secondary_sources/gmail/` but was removed to focus on core Google Drive functionality.

### Web Content Integration (Firecrawl)
- **Purpose**: Capture knowledge from websites, documentation, and online resources
- **Priority**: Low
- **Complexity**: Medium
- **Implementation Scope**:
  - Website content extraction via Firecrawl API
  - URL queue management and processing
  - Content deduplication across web sources
  - Intelligent content filtering

**Technical Requirements**:
- Firecrawl API service integration
- URL management and crawling strategy
- Content extraction and cleaning
- Rate limiting and respectful crawling

**Previous Implementation Note**: Basic implementation existed in `src/secondary_sources/firecrawl/` but was removed to simplify the codebase.

## Architecture for Future Integrations

All secondary source integrations should follow these patterns established by the Google Drive implementation:

### Core Integration Pattern
1. **Source Ingester**: Implement `SourceContent` model ingestion
2. **Package Structure**: Add to `src/secondary_sources/{integration_name}/`
3. **Pipeline Integration**: Extend `run_pipeline.py` with new source options
4. **Configuration**: Add relevant config classes to `src/core/config.py`
5. **Enrichment Flow**: Follow same AI enrichment workflow as Drive content

### Extensibility Points
- `src/secondary_sources/` - Reserved package structure for future integrations
- `run_pipeline.py --source` - Command-line interface ready for new sources
- `PipelineConfig` - Configuration system designed for multiple source types
- Notion database schema - Supports content from any source type

## Development Guidelines

When implementing these features:

1. **Follow Existing Patterns**: Use Google Drive implementation as reference
2. **Maintain Simplicity**: Keep core pipeline focused and modular
3. **Respect Rate Limits**: Implement appropriate delays and backoff strategies
4. **Error Resilience**: Follow resilience patterns from `src/utils/resilience.py`
5. **Configuration**: Use environment variables following existing conventions
6. **Testing**: Add comprehensive tests following patterns in `tests/`

## Implementation Priority

1. **Gmail Integration** - Higher value for knowledge workers, builds on existing Google ecosystem
2. **Web Content Integration** - Lower priority, useful for research and documentation capture

The current Google Drive focus ensures a robust, reliable core before expanding to additional sources.