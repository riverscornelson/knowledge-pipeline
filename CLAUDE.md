# Knowledge Pipeline - Claude.md

This Claude.md file provides persistent global context for developing the Knowledge Pipeline - a personal automation system for processing market research and news into a structured Notion knowledge base.

## Core Project Philosophy

The Knowledge Pipeline is a production system that has been running successfully for months, with a mature architecture that should be preserved and extended thoughtfully, not rebuilt.

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

## Architecture Principles (MAINTAIN THESE)

### Separation of Concerns

- `src/core/` - Core configuration and shared functionality
- `src/drive/` - PRIMARY source: Google Drive PDF ingestion
- `src/enrichment/` - AI processing and content analysis
- `src/secondary_sources/` - Reserved for future integrations (don’t use yet)
- `src/utils/` - Shared utilities and helpers

### Priority-Based Architecture

- Google Drive is PRIMARY source - always prioritize its stability
- Secondary sources are additive - never break primary functionality

### Configuration-Driven Design

- Use environment variables for all configuration (`.env` file)
- Maintain dual-source prompt management: Notion (dynamic) + YAML (fallback)
- Never hardcode API keys, endpoints, or business logic

## Testing Requirements

**BEFORE ANY COMMIT, YOU MUST:**

```bash
# Run full test suite
python -m pytest

# Run with coverage (should maintain 38%+ overall, 94-100% for core modules)
python -m pytest --cov=src --cov-report=html

# Run specific module tests based on your changes
python -m pytest tests/core/      # For core functionality changes
python -m pytest tests/drive/     # For Drive integration changes  
python -m pytest tests/enrichment/ # For AI processing changes
```

All tests must pass. If you break existing tests, fix them as part of your changes.

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

### API Integration Guidelines

- **Google Drive API**: Handle rate limiting, respect file permissions
- **Notion API**: Maintain rich formatting when posting content to Notion, handle API limits, preserve database structure
- **OpenAI API**: Use appropriate models (GPT-4.1 default, o3 for web-enabled tasks)

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

## Command Reference

**Setup and Configuration:**

```bash
pip install -e .
cp .env.example .env  # Edit with your API keys
```

**Running the Pipeline:**

```bash
# Full pipeline with local PDF processing (RECOMMENDED)
python scripts/run_pipeline.py --process-local

# Standard pipeline (Drive content only)  
python scripts/run_pipeline.py

# Skip enrichment (ingestion only)
python scripts/run_pipeline.py --skip-enrichment
```

**Development and Testing:**

```bash
# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=src --cov-report=html

# Run specific test categories
python -m pytest tests/core/
python -m pytest tests/drive/
python -m pytest tests/enrichment/
```

Remember: This is a production system that adds real value to the user’s research workflow. Maintain its reliability and extend it thoughtfully.