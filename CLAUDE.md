# Knowledge Pipeline v4.0.0 - Claude.md

This Claude.md file provides persistent global context for developing the Knowledge Pipeline - a CLI-based automation tool for intelligent content processing and Notion knowledge base management.

## Core Project Philosophy

The Knowledge Pipeline v4.0.0 is a mature, production-ready CLI automation system that has been streamlined and optimized. The cleaned-up architecture focuses on core functionality while maintaining reliability and extensibility.

## CRITICAL: Design-First Development Process

**IMPORTANT!!! ALWAYS FOLLOW THIS PROCESS BEFORE MAKING ANY CODE CHANGES:**

1. **Planning Phase**: Before touching any code, create a detailed design document that includes:
- Problem statement and requirements
- Proposed changes to architecture/modules
- Impact on existing functionality
- Test plan for validation
- Temporary files/artifacts needed (organize these properly)
1. **Get Approval**: Present the design plan to the user for approval before implementation
1. **Complete Implementation**: Implement the ENTIRE feature before stopping - no half-implemented functionality that could destabilize the codebase
1. **Clean Up**: Remove ALL temporary files, plans, and development artifacts
1. **Validate**: Run tests and verify the implementation works end-to-end

## Architecture Principles (v4.0.0 CLEANED-UP)

### Separation of Concerns

- `src/core/` - Core configuration, models, and Notion client
- `src/drive/` - PRIMARY source: Google Drive PDF ingestion and processing
- `src/enrichment/` - AI processing, content analysis, and prompt attribution
- `src/formatters/` - Notion formatting with enhanced attribution and visual hierarchy
- `src/local_uploader/` - Local PDF processing and OAuth2 uploads
- `src/utils/` - Shared utilities, logging, and markdown processing

### CLI-First Architecture

- Command-line interface as the primary user experience
- Script-based automation for production environments
- Clean separation between CLI scripts and core library code
- Environment variable configuration for all settings

### Configuration-Driven Design

- Environment variables for all configuration (`.env` file)
- Dual-source prompt management: Notion database (dynamic) + YAML (fallback)
- Modern Python packaging with pyproject.toml
- Comprehensive logging with structured JSON output

## Testing Requirements (v4.0.0)

**BEFORE ANY COMMIT, YOU MUST:**

```bash
# Run full test suite (49 tests, 100% pass rate)
python -m pytest

# Run with coverage (maintain 38%+ overall, 94-100% for core modules)
python -m pytest --cov=src --cov-report=html

# Run specific module tests based on your changes
python -m pytest tests/core/        # Core functionality (config, models, notion_client)
python -m pytest tests/drive/       # Drive integration (ingestion, deduplication, PDF processing)
python -m pytest tests/enrichment/  # AI processing (pipeline, attribution, quality scoring)
python -m pytest tests/formatters/  # Notion formatting and attribution
```

**Current Test Status**: 49 tests, 100% pass rate, 38% overall coverage with 94-100% coverage for core modules.
All tests must pass. The v4.0.0 architecture includes comprehensive test coverage for all critical components.

## Development Standards

### Code Quality

- Follow existing code patterns and naming conventions
- Maintain structured JSON logging format
- Use proper error handling with retry logic
- Keep functions focused and testable

### File Organization

- No temporary files left in repository
- Development artifacts must be cleaned up
- Use proper Python packaging standards
- Maintain clean git history

### API Integration Guidelines (v4.0.0)

- **Google Drive API**: OAuth2 and service account support, secure token storage, rate limiting with retry logic
- **Notion API**: Enhanced formatting with attribution blocks, quality indicators, rich text with headers/callouts
- **OpenAI API**: Model flexibility (GPT-4.1 default, GPT-4.1-mini for classification), token optimization, prompt attribution tracking

## Content Processing Requirements

### Prompt Attribution System (CRITICAL)

**The pipeline tracks which prompts generate each piece of content. ALWAYS:**

- Preserve prompt attribution metadata in all content processing
- Maintain the dual-source prompt system (Notion + YAML fallback)
- Ensure prompts are loaded dynamically from Notion when test runs are taking place
- Test prompt attribution is working after any enrichment changes

### Content Type Detection

When modifying content classification:

- Test with sample PDFs of different types (research papers, market news, etc.)
- Verify Notion formatting remains consistent
- Ensure quality scoring continues to work
- Validate that content-specific prompts are applied correctly

### Model Selection Logic

- **GPT-4.1**: Default for processing, cost-effective
- **o3**: Only when web search is enabled, for complex reasoning
- Monitor costs and processing time in logs
- Never switch models without considering cost implications

## Security & Operations

### Data Handling

- All processing happens locally on user’s machine, with the exception of LLM API calls
- Tokens stored securely with strict file permissions (0600)
- No data sharing beyond configured services (Google Drive, Notion)
- Maintain audit logging for all operations

### Local Automation

- Pipeline runs nightly via local automation
- Must handle graceful failures without user intervention
- Log structured data for monitoring and debugging
- Support incremental processing to avoid re-work

## Prompt Management

### Dynamic Prompt Loading

**ALWAYS ensure prompts are loaded dynamically from Notion when available:**

- Check Notion prompts database first
- Fall back to YAML config if Notion unavailable
- Maintain version control for prompt changes
- Test both prompt sources work correctly

### Prompt Development

When working with prompts:

- Use the established content-type specific prompt structure
- Maintain Jinja2 template syntax compatibility
- Preserve prompt attribution tracking
- Test with multiple content types before deploying

## Quality Assurance

### Before Each Commit

1. **Run Tests**: All tests must pass
1. **Check Logs**: Verify structured logging still works
1. **Test Pipeline**: Run end-to-end with sample content
1. **Validate Notion**: Ensure formatting and attribution work
1. **Cost Check**: Monitor AI processing costs in development

### Performance Considerations

- Pipeline processes 6-10 minutes for batches
- SHA-256 deduplication prevents unnecessary reprocessing
- Respect API rate limits (Google Drive, Notion, OpenAI)
- Monitor memory usage during local PDF processing

## Extension Guidelines

### Adding New Features

- Follow the modular architecture
- Add comprehensive tests for new functionality
- Update documentation and migration guides
- Consider impact on existing automation
- Plan for future Notion migration path

### Integration Patterns

- Use existing patterns in `src/drive/` as reference
- Implement proper error handling and logging
- Support graceful degradation when services unavailable
- Maintain user control over data and processing

## Migration Preparedness

The system is designed to eventually migrate from Notion to a more scalable solution:

- Keep data structure logic separate from Notion-specific code
- Use abstraction layers for data storage operations
- Maintain export capabilities
- Design new features with portability in mind

-----

## CLI Command Reference (v4.0.0)

**Setup and Configuration:**

```bash
# Install the pipeline
pip install -e .

# Configure environment
cp .env.example .env  # Edit with your API keys and settings

# Verify installation
python scripts/run_pipeline.py --dry-run
```

**Running the Pipeline:**

```bash
# Full pipeline with local PDF processing (RECOMMENDED)
python scripts/run_pipeline.py --process-local

# Standard pipeline (Google Drive content only)
python scripts/run_pipeline.py

# Ingestion only (skip AI enrichment)
python scripts/run_pipeline.py --skip-enrichment

# Process specific files
python scripts/run_pipeline.py --drive-file-ids "abc123,def456"

# Test configuration without changes
python scripts/run_pipeline.py --dry-run
```

**Development and Testing:**

```bash
# Run all tests (49 tests, 100% pass rate)
python -m pytest

# Run with coverage report
python -m pytest --cov=src --cov-report=html

# Run specific test categories
python -m pytest tests/core/        # Core functionality
python -m pytest tests/drive/       # Google Drive integration
python -m pytest tests/enrichment/  # AI processing
python -m pytest tests/formatters/  # Notion formatting
```

**Utility Commands:**

```bash
# View enriched content
python scripts/view_enriched_content.py --limit 10

# Migrate to enhanced formatters (if upgrading)
python scripts/migrate_to_prompt_aware_formatter.py
```

**v4.0.0 Status**: This is a production-ready CLI automation system with comprehensive testing, enhanced features, and streamlined architecture. Maintain its reliability and extend it thoughtfully.